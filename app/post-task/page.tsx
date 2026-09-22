'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import { createTask, recordTaskFunding, deleteTask, getAuthToken } from '../components/api';
import { useWallet, ARC_TESTNET_CHAIN_ID } from '../components/WalletProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { TASK_ESCROW_ADDRESS, USDC_ADDRESS } from '../components/contracts';
import styles from './post-task.module.css';

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

const TASK_ESCROW_ABI = [
  "function createTask(uint256 taskId, uint256 bounty) external",
  "function fundTask(uint256 taskId) external",
  "function getTask(uint256 taskId) external view returns (tuple(address creator, address worker, uint256 bounty, bool funded, bool completed))"
];

export default function PostTask() {
  const router = useRouter();
  const { account, user, connectWallet, switchToArcTestnet } = useWallet();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState<number | ''>('');
  const [fundOnChain, setFundOnChain] = useState(true);
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

    if (!title || !description || bounty === '' || Number(bounty) <= 0) {
      setError('Please fill in all fields with valid data.');
      return;
    }

    // 2. Strict Arc Testnet check upfront before backend or contract calls
    if (fundOnChain && typeof window !== 'undefined' && (window as any).ethereum) {
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
      const createdTask = await createTask({
        title,
        description,
        bounty_usdc: Number(bounty),
        poster_wallet_address: account,
      });
      createdTaskId = createdTask.id;

      if (fundOnChain && typeof window !== 'undefined' && (window as any).ethereum) {
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

        if (!alreadyCreated) {
          setStatusMsg('Registering task in Arc Escrow contract...');
          try {
            const createTx = await escrow["createTask(uint256,uint256)"](createdTaskId, bountyUnits);
            await createTx.wait();
          } catch (createErr: any) {
            if (createErr.code === 'CALL_EXCEPTION' || createErr.message?.includes('missing revert data')) {
              throw new Error(
                `The contract at ${TASK_ESCROW_ADDRESS} does not support open task creation (createTask without upfront worker). Please deploy the updated TaskEscrow contract to Arc Testnet.`
              );
            }
            throw createErr;
          }
        }

        setStatusMsg('Funding Escrow with USDC...');
        const fundTx = await escrow.fundTask(createdTaskId);
        setStatusMsg('Confirming on-chain funding...');
        const receipt = await fundTx.wait();

        // 3. Update backend with on-chain funding tx hash
        setStatusMsg('Synchronizing escrow status with backend...');
        await recordTaskFunding(createdTaskId, account, receipt.hash || fundTx.hash);
      }

      router.push('/marketplace');
    } catch (err: any) {
      console.error(err);
      // If user rejected the on-chain transaction or funding failed, delete draft task so it's not created
      if (createdTaskId) {
        try {
          await deleteTask(createdTaskId, account);
        } catch (delErr) {
          console.warn('Failed to clean up un-funded task:', delErr);
        }
      }
      setError(
        `Task creation cancelled: ${
          err.code === 4001 || err.message?.includes('rejected')
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
      <main style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px', width: '100%', flex: 1 }}>
        <div
          className={`antares-card animate-rise glass-thick ${styles.modal}`}
          style={{ width: '100%', maxWidth: '100%' }}
        >
          <div className={styles.header}>
            <div>
              <div className="text-label-micro">Arc Escrow Marketplace</div>
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#60a5fa',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid #60a5fa',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }}
              />
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
                  placeholder="100.00"
                  className={`antares-input glass ${styles.bountyInput}`}
                  required
                />
                <span className={styles.currencyLabel}>
                  USDC
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: 'var(--surface-2)', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <input
                type="checkbox"
                id="fundOnChainToggle"
                checked={fundOnChain}
                onChange={(e) => setFundOnChain(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent)' }}
              />
              <label htmlFor="fundOnChainToggle" style={{ fontSize: '13px', color: 'var(--fg)', cursor: 'pointer', fontWeight: 500 }}>
                Fund Escrow with USDC immediately on Arc Testnet
              </label>
            </div>

            <div className={styles.ruleBox}>
              <span className={styles.ruleLabel}>Escrow Release Rule</span>
              <span className={styles.ruleValue}>GitHub PR Verification</span>
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
