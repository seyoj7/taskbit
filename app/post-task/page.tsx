'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import { createTask, recordTaskFunding, deleteTask, getAuthToken } from '../components/api';
import { useWallet, ARC_TESTNET_CHAIN_ID } from '../components/WalletProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { TASK_ESCROW_ABI, TASK_ESCROW_ADDRESS, USDC_ADDRESS, USDC_ABI } from '../components/contracts';
import styles from './post-task.module.css';


export default function PostTask() {
  const router = useRouter();
  const { account, user, connectWallet, switchToArcTestnet } = useWallet();
  const [title, setTitle] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState<number | ''>('');
  const [deadlineMode, setDeadlineMode] = useState<'3d' | '1w' | '2w' | 'custom'>('1w');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    if (deadlineMode === 'custom') return;
    const date = new Date();
    if (deadlineMode === '3d') date.setDate(date.getDate() + 3);
    else if (deadlineMode === '1w') date.setDate(date.getDate() + 7);
    else if (deadlineMode === '2w') date.setDate(date.getDate() + 14);

    // Format as YYYY-MM-DDThh:mm for datetime-local compatibility (and standard ISO)
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    setExpiresAt(localISOTime);
  }, [deadlineMode]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);

    // 1. Strict sign-in check: user must be connected AND have a valid wallet signature token
    const token = getAuthToken();
    if (!account || !user || !token) {
      setError('You must sign in with your wallet signature before creating a task.');
      await connectWallet();
      return;
    }

    if (!title || !description || bounty === '' || Number(bounty) <= 0 || !expiresAt) {
      setError('Please fill in all fields with valid data.');
      return;
    }
    const expiryDate = new Date(expiresAt);
    if (expiryDate.getTime() <= Date.now()) {
      setError('Deadline must be in the future.');
      return;
    }

    // 2. Strict Arc Testnet check upfront before backend or contract calls
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
        setStatusMsg('Switching wallet to Arc Testnet (Chain ID 5042002)...');
        const switched = await switchToArcTestnet();
        if (!switched) {
          setError('Taskbit strictly operates on Arc Testnet (Chain ID 5042002). Please switch network in your wallet to continue.');
          return;
        }
      }
    }

    setLoading(true);
    let createdTaskId: number | null = null;

    try {
      setStatusMsg('Creating task record...');
      const finalDescription = githubRepo
        ? `**GitHub Repository:** ${githubRepo}\n\n${description}`
        : description;

      const createdTask = await createTask({
        title,
        description: finalDescription,
        bounty_usdc: Number(bounty),
        poster_wallet_address: account,
        expires_at: expiryDate.toISOString(),
      });
      createdTaskId = createdTask.id;

      if (typeof window !== 'undefined' && (window as any).ethereum) {
        setStatusMsg('Connecting to Arc Testnet wallet...');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        const bountyUnits = BigInt(Math.round(Number(bounty) * 1_000_000));
        const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
        const escrow = new ethers.Contract(TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI, signer);

        // 1. Check & approve USDC allowance
        setStatusMsg('Checking USDC allowance...');
        try {
          const allowance: bigint = await usdc.allowance(account, TASK_ESCROW_ADDRESS);
          if (allowance < bountyUnits) {
            setStatusMsg('Please approve USDC spend in your wallet...');
            const approveTx = await usdc.approve(TASK_ESCROW_ADDRESS, bountyUnits);
            setStatusMsg('Waiting for USDC approval confirmation...');
            await approveTx.wait();
          }
        } catch (allowanceErr: any) {
          console.warn('Could not verify allowance:', allowanceErr);
        }

        // 2. Register task in escrow contract if not already registered
        let alreadyCreated = false;
        try {
          const t = await escrow.getTask(createdTaskId);
          if (t && t.creator && t.creator !== ethers.ZeroAddress) {
            alreadyCreated = true;
          }
        } catch {
          alreadyCreated = false;
        }

        let finalTxHash = '';
        if (!alreadyCreated) {
          setStatusMsg('Registering and Funding task on Arc Escrow...');
          try {
            const expiryTimestamp = Math.floor(expiryDate.getTime() / 1000);
            const createTx = await escrow["createTask(uint256,uint256,uint256)"](createdTaskId, bountyUnits, expiryTimestamp);
            setStatusMsg('Confirming on-chain transaction...');
            const receipt = await createTx.wait();
            finalTxHash = receipt?.hash || createTx.hash;
          } catch (createErr: any) {
            if (createErr.code === 'CALL_EXCEPTION' || createErr.message?.includes('missing revert data')) {
              throw new Error(
                `The contract at ${TASK_ESCROW_ADDRESS} does not support open task creation (createTask without upfront worker). Please deploy the updated TaskEscrow contract to Arc Testnet.`
              );
            }
            throw createErr;
          }
        }

        // 3. Update backend with on-chain funding tx hash
        if (finalTxHash) {
          setStatusMsg('Synchronizing escrow status with backend...');
          await recordTaskFunding(createdTaskId, account, finalTxHash);
        }
      }

      router.push('/marketplace');
    } catch (err: any) {
      console.error(err);
      // Delete the unfunded task so it doesn't persist as "Pending Funding"
      if (createdTaskId) {
        try {
          await deleteTask(createdTaskId);
        } catch (deleteErr) {
          console.warn('Could not clean up unfunded task:', deleteErr);
        }
      }
      setError(
        `Task creation cancelled: ${err.code === 4001 || err.message?.includes('rejected')
          ? 'Wallet transaction rejected.'
          : (err.reason || err.message || 'Transaction could not be completed.')
        }`
      );
    } finally {
      setLoading(false);
      setStatusMsg(null);
    }
  };


  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div
          className={`antares-card animate-rise glass-thick ${styles.modal} ${styles.modalFull}`}
        >
          <div className={styles.header}>
            <div>
              <h2 className={styles.title}>
                Create New Bounty
              </h2>
            </div>
          </div>

          {error && (
            <div className={styles.errorBanner}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          {statusMsg && (
            <div className={styles.statusBanner}>
              <span className={styles.statusSpinner} />
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div>
              <label className={styles.label}>
                Task Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement Arc smart contract tests"
                className="antares-input glass"
                required
              />
            </div>

            <div>
              <label className={styles.label}>
                GitHub Repository Link
              </label>
              <input
                type="url"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="antares-input glass"
                required
              />
            </div>

            <div>
              <label className={styles.label}>
                Requirements & Proof Instructions
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe deliverables, requirements, and required GitHub PR link format..."
                rows={4}
                className={`antares-input glass ${styles.textarea}`}
                required
              />
            </div>

            <div>
              <label className={styles.label}>
                Bounty Escrow (USDC)
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={bounty}
                  onChange={(e) => setBounty(e.target.value ? Number(e.target.value) : '')}
                  placeholder="10.00"
                  className={`antares-input glass ${styles.bountyInput}`}
                  required
                />
                <span className={styles.currencyLabel}>
                  USDC
                </span>
              </div>
            </div>

            <div>
              <label className={`${styles.label} ${styles.deadlineLabelFlex}`}>
                <span>Task Deadline</span>
                <span className={styles.deadlinePreview}>
                  {deadlineMode !== 'custom' && expiresAt ? new Date(expiresAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                </span>
              </label>
              <div className={deadlineMode === 'custom' ? styles.deadlineGridSpaced : styles.deadlineGrid}>
                {([
                  { id: '3d', label: '3 Days' },
                  { id: '1w', label: '1 Week' },
                  { id: '2w', label: '2 Weeks' },
                  { id: 'custom', label: 'Custom' }
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDeadlineMode(opt.id)}
                    className={`${deadlineMode === opt.id ? 'antares-btn-accent' : 'antares-btn-surface'} ${styles.deadlineBtn}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {deadlineMode === 'custom' && (
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => {
                    setExpiresAt(e.target.value);
                    setDeadlineMode('custom');
                  }}
                  className={`antares-input glass animate-rise ${styles.dateInput}`}
                  required
                />
              )}
            </div>

            <div className={styles.checkboxRow}>
              <input
                type="checkbox"
                id="fundOnChainToggle"
                checked={true}
                readOnly
                className={styles.checkboxInput}
              />
              <label htmlFor="fundOnChainToggle" className={styles.checkboxLabel}>
                Fund Escrow task with USDC
              </label>
            </div>


            {(!account || !user) ? (
              <button
                type="button"
                className={`antares-btn-accent ${styles.submitBtn}`}
                onClick={connectWallet}
              >
                Sign In with Wallet to Post
              </button>
            ) : (
              <button
                type="submit"
                className={`antares-btn-accent ${styles.submitBtnActive}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    {statusMsg || 'Processing Escrow…'}
                  </>
                ) : 'Deposit & Post Bounty'}
              </button>
            )}
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
