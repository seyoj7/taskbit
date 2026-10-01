'use client';

import { useRouter } from 'next/navigation';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  id: string | number;
  title: string;
  description: string;
  bounty: number;
  status: 'Open' | 'In Progress' | 'Completed' | string;
  poster_wallet_address?: string;
}

export default function TaskCard({ id, title, description, bounty, status, poster_wallet_address }: TaskCardProps) {
  const router = useRouter();
  const formattedId = typeof id === 'number' ? `#${String(id).padStart(4, '0')}` : `#${id}`;

  const renderStatusBadge = () => {
    const s = String(status).toLowerCase();
    if (s === 'posted') {
      return (
        <span className={styles.idBadge}>
          Pending Funding
        </span>
      );
    }
    if (s === 'funded') {
      return (
        <span className={styles.statusOpen}>
          <span className={styles.dotPulse} />
          Open
        </span>
      );
    }
    if (s === 'submitted') {
      return (
        <span className={styles.statusReview}>
          <span className={styles.dot} />
          Reviewing
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className={styles.statusReview}>
          <span className={styles.dot} />
          Rejected
        </span>
      );
    }
    if (s === 'approved' || s === 'paid') {
      return (
        <span className={styles.statusPaid}>
          ✓ Paid
        </span>
      );
    }
    if (s === 'refunded') {
      return (
        <span className={styles.statusRefunded}>
          <span className={styles.dot} />
          Refunded
        </span>
      );
    }
    if (s === 'archived') {
      return (
        <span className={styles.idBadge}>
          Archived
        </span>
      );
    }
    if (s === 'expired') {
      return (
        <span className={styles.statusRefunded}>
          <span className={styles.dot} />
          Expired
        </span>
      );
    }
    return (
      <span className={styles.idBadge}>
        {status}
      </span>
    );
  };

  return (
    <div
      onClick={() => router.push(`/overview/${id}`)}
      className={styles.card}
    >
      <div className={styles.headerRow}>
        <div className={styles.badgeGroup}>
          <span className={styles.idBadge}>
            {formattedId}
          </span>

          {poster_wallet_address && (
            <span className={styles.idBadge} title={`Poster: ${poster_wallet_address}`}>
              {poster_wallet_address.slice(0, 6)}...{poster_wallet_address.slice(-4)}
            </span>
          )}
        </div>
        {renderStatusBadge()}
      </div>

      <div className={styles.bodySection}>
        <h3 className={styles.title}>
          {title}
        </h3>

        <p className={styles.description}>
          {description || 'No description provided.'}
        </p>

        <div className={styles.proofStrip}>
          <span className={styles.proofTag} title="Proof verified via GitHub PR">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" />
              <line x1="6" y1="9" x2="6" y2="21" />
            </svg>
            <span>GitHub PR Proof</span>
          </span>
          <span className={styles.escrowBadge}>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.escrowIcon}
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            On-Chain Escrow
          </span>
        </div>
      </div>

      <div className={styles.footerRow}>
        <div className={styles.bountyGroup}>
          <span className={styles.bountyLabel}>Escrow Reward</span>
          <div className={styles.bountyAmount}>
            <span>${bounty}</span>
            <span className={styles.bountyCurrency}>USDC</span>
          </div>
        </div>

        <div className={styles.actionPill}>
          <span>View Issue</span>
          <span className={styles.actionArrow}>↗</span>
        </div>
      </div>
    </div>
  );
}
