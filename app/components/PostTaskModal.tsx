'use client';

import React, { useState } from 'react';
import { createTask } from './api';
import { useWallet } from './WalletProvider';

interface PostTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PostTaskModal({ isOpen, onClose, onSuccess }: PostTaskModalProps) {
  const { account, connectWallet } = useWallet();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      setTitle('');
      setDescription('');
      setBounty('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to post task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="antares-card animate-rise glass-thick"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '32px',
          position: 'relative',
          backgroundColor: 'var(--surface)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div className="text-label-micro">Arc Escrow Marketplace</div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--fg)', marginTop: '4px', letterSpacing: '-0.02em' }}>
              Create New Bounty
            </h2>
          </div>
          <button
            onClick={onClose}
            className="antares-icon-btn"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              color: 'var(--down)',
              fontSize: '14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
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
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
              Requirements & Proof Instructions
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe deliverables, requirements, and required PR link format..."
              rows={4}
              className="antares-input glass"
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
              Bounty Escrow (USDC)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="1"
                step="0.01"
                value={bounty}
                onChange={(e) => setBounty(e.target.value ? Number(e.target.value) : '')}
                placeholder="100.00"
                className="antares-input glass"
                style={{ paddingRight: '80px', fontFamily: 'var(--font-mono)', fontSize: '16px' }}
                required
              />
              <span
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--muted)',
                }}
              >
                USDC
              </span>
            </div>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
            }}
          >
            <span style={{ color: 'var(--muted)' }}>Escrow Release Rule</span>
            <span style={{ fontWeight: 600, color: 'var(--fg)' }}>GitHub PR Verification</span>
          </div>

          {!account ? (
            <button
              type="button"
              className="antares-btn-accent"
              style={{ width: '100%', height: '52px', marginTop: '8px' }}
              onClick={connectWallet}
            >
              Connect Wallet to Post
            </button>
          ) : (
            <button
              type="submit"
              className="antares-btn-accent"
              disabled={loading}
              style={{ width: '100%', height: '52px', marginTop: '8px', fontSize: '15px' }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--accent-fg)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Creating Task…
                </>
              ) : 'Deposit & Post Bounty'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
