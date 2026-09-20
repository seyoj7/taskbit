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
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="antares-card animate-rise"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '28px',
          position: 'relative',
          backgroundColor: 'var(--surface)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div className="text-label-micro">Arc Escrow Marketplace</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--fg)', marginTop: '2px' }}>
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
              padding: '10px 14px',
              backgroundColor: 'rgba(220, 38, 38, 0.12)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              borderRadius: '10px',
              color: 'var(--down)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement Arc smart contract tests"
              className="antares-input"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
              Requirements & Proof Instructions
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe deliverables, requirements, and required PR link format..."
              rows={4}
              className="antares-input"
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
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
                className="antares-input"
                style={{ paddingRight: '64px', fontFamily: 'var(--font-geist-mono), monospace' }}
                required
              />
              <span
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '12px',
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
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--muted)' }}>Escrow Release Rule</span>
            <span style={{ fontWeight: 600, color: 'var(--fg)' }}>GitHub PR Verification</span>
          </div>

          {!account ? (
            <button
              type="button"
              className="antares-btn-accent"
              style={{ width: '100%', height: '44px', marginTop: '4px' }}
              onClick={connectWallet}
            >
              Connect Wallet to Post
            </button>
          ) : (
            <button
              type="submit"
              className="antares-btn-accent"
              disabled={loading}
              style={{ width: '100%', height: '44px', marginTop: '4px' }}
            >
              {loading ? 'Creating Task…' : 'Deposit & Post Bounty'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
