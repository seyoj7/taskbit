'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useWallet } from './WalletProvider';
import styles from './Navbar.module.css';

export default function Navbar() {
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
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Brand */}
        <Link href="/" className={styles.brandLink}>
          <img src="/taskbit_logo.png" alt="Taskbit Logo" className={styles.logo} />
          <span className={styles.brandName}>Taskbit</span>
        </Link>

        {/* Center Pill Segmented Nav */}
        <div className={`antares-nav-pill-container ${styles.navPills}`}>
          <Link
            href="/marketplace"
            className={`antares-nav-pill ${pathname === '/marketplace' || pathname?.startsWith('/overview') ? 'active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.navIcon}
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
              className={styles.navIcon}
            >
              <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
            </svg>
            <span>Overview</span>
          </Link>

          <Link
            href="/post-task"
            className={`antares-nav-pill ${pathname === '/post-task' ? 'active' : ''} ${styles.postTaskBtn}`}
          >
            <span className={styles.postTaskPlus}>+</span>
            <span>Post Task</span>
          </Link>
        </div>

        {/* Right Section: Wallet */}
        <div className={styles.rightSection}>
          {/* Wallet Button with Dropdown */}
          {account ? (
            <div ref={dropdownRef} className={styles.walletContainer}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`antares-btn-surface ${styles.walletBtn}`}
                title="Wallet options"
              >
                <span className={styles.statusDot} />
                <span>{account.slice(0, 6)}...{account.slice(-6)}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`${styles.dropdownArrow} ${isDropdownOpen ? styles.dropdownArrowOpen : ''}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className={styles.dropdownMenu}>
                  {/* Account Summary & Copy */}
                  <div className={styles.accountSummary}>
                    <div className={styles.accountDetails}>
                      <span className={styles.accountLabel}>Connected Wallet</span>
                      <span className={styles.accountAddress}>{account.slice(0, 6)}...{account.slice(-4)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      title="Copy Address"
                      className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
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

                  <div className={styles.divider} />

                  {/* Disconnect Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      disconnectWallet();
                    }}
                    className={styles.disconnectBtn}
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
              className={`antares-btn-accent ${styles.connectBtn}`}
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
