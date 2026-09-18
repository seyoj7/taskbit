'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';

interface NavbarProps {
  onOpenPostTask?: () => void;
}

export default function Navbar({ onOpenPostTask }: NavbarProps) {
  const pathname = usePathname();
  const { account, connectWallet, disconnectWallet, isLoading } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };


  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        borderBottom: '1px solid var(--line)',
        backgroundColor: 'var(--surface)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          height: '64px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '15px',
              boxShadow: '0 2px 8px rgba(206, 249, 16, 0.3)',
            }}
          >
            ✦
          </div>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--fg)',
            }}
          >
            Taskbit
          </span>
        </Link>

        {/* Center Pill Segmented Nav */}
        <div className="antares-nav-pill-container" style={{ display: 'flex' }}>
          <Link
            href="/dashboard"
            className={`antares-nav-pill ${pathname === '/dashboard' || pathname?.startsWith('/tasks') ? 'active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '14px', height: '14px' }}
            >
              <path d="M4 9h16l-1 10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L4 9Z" />
              <path d="M4 9 6 4h12l2 5" />
              <path d="M9.5 13a2.5 2.5 0 0 0 5 0" />
            </svg>
            <span>Marketplace</span>
          </Link>

          <Link
            href="/"
            className={`antares-nav-pill ${pathname === '/' ? 'active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '14px', height: '14px' }}
            >
              <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
            </svg>
            <span>Overview</span>
          </Link>

          {onOpenPostTask && (
            <button
              onClick={onOpenPostTask}
              className="antares-nav-pill"
              style={{ color: 'var(--accent)' }}
            >
              <span style={{ fontWeight: 700 }}>+</span>
              <span>Post Task</span>
            </button>
          )}
        </div>

        {/* Right Section: Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Wallet Button with Dropdown */}
          {account ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="antares-btn-surface"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '36px',
                  padding: '0 12px 0 14px',
                  borderRadius: '9999px',
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--surface-2)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-geist-mono), monospace',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  color: 'var(--fg)',
                  transition: 'all 0.15s ease',
                }}
                title="Wallet options"
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--up)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>{account.slice(0, 6)}...{account.slice(-6)}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: '12px',
                    height: '12px',
                    color: 'var(--muted)',
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: '210px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '14px',
                    padding: '6px',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    zIndex: 50,
                  }}
                >
                  {/* Account Summary & Copy */}
                  <div
                    style={{
                      padding: '8px 10px',
                      marginBottom: '4px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Connected Wallet
                      </span>
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-geist-mono), monospace', color: 'var(--fg)', fontWeight: 600 }}>
                        {account.slice(0, 6)}...{account.slice(-4)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      title="Copy Address"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copied ? 'var(--up)' : 'var(--muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 600,
                        gap: '4px',
                      }}
                    >
                      {copied ? (
                        <span>Copied!</span>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--line)', margin: '4px 0' }} />

                  {/* Disconnect Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      disconnectWallet();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'none',
                      color: '#ef4444',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Disconnect</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="antares-btn-accent"
              style={{ height: '36px', padding: '0 16px', fontSize: '13px' }}
              onClick={connectWallet}
              disabled={isLoading}
            >
              <span>{isLoading ? "Connecting…" : "Connect Wallet"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
