'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '../components/api';
import { useWallet } from '../components/WalletProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import styles from './post-task.module.css';

export default function PostTask() {
  const router = useRouter();
  const { account, connectWallet } = useWallet();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!account) {
      setError('Please connect your wallet first.');
      return;
    }
    if (!title || !description || bounty === '' || Number(bounty) <= 0) {
      setError('Please fill in all fields with valid data.');
      return;
    }

    setLoading(true);
    try {
      // 1. In a fully on-chain world, the poster would lock funds when creating, 
      // but TaskEscrow.sol requires a known worker. So we just post to the backend for now.
      await createTask({
        title,
        description,
        bounty_usdc: Number(bounty),
        poster_wallet_address: account,
      });
      router.push('/marketplace');
    } catch (err: any) {
      setError(err.message || 'Failed to post task');
    } finally {
      setLoading(false);
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
          {/* Header */}
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
                placeholder="Describe deliverables, requirements, and required PR link format..."
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

            <div className={styles.ruleBox}>
              <span className={styles.ruleLabel}>Escrow Release Rule</span>
              <span className={styles.ruleValue}>GitHub PR Verification</span>
            </div>

            {!account ? (
              <button
                type="button"
                className={`antares-btn-accent ${styles.submitBtn}`}
                onClick={connectWallet}
              >
                Connect Wallet to Post
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
                    Creating Task…
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
