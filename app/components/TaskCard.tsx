'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface TaskCardProps {
  id: string | number;
  title: string;
  description: string;
  bounty: number;
  status: 'Open' | 'In Progress' | 'Completed' | string;
}

export default function TaskCard({ id, title, description, bounty, status }: TaskCardProps) {
  const router = useRouter();

  const formattedId = typeof id === 'number' ? `#${String(id).padStart(4, '0')}` : `#${id}`;

  const renderStatusBadge = () => {
    const s = String(status).toLowerCase();
    if (s === 'open') {
      return (
        <span className="antares-badge antares-badge-lime">
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
          Open
        </span>
      );
    }
    if (s === 'in progress' || s === 'claimed' || s === 'submitted') {
      return (
        <span className="antares-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
          {s === 'submitted' ? 'Reviewing' : 'In Progress'}
        </span>
      );
    }
    if (s === 'completed' || s === 'approved') {
      return (
        <span className="antares-badge antares-badge-up">
          ✓ Paid
        </span>
      );
    }
    return (
      <span className="antares-badge antares-badge-surface">
        {status}
      </span>
    );
  };

  return (
    <div
      onClick={() => router.push(`/tasks/${id}`)}
      className="antares-card antares-card-interactive"
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Visual Thumbnail Area */}
      <div
        style={{
          height: '140px',
          backgroundColor: 'var(--surface-2)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '12px',
          borderBottom: '1px solid var(--line)',
          backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(206, 249, 16, 0.08) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(109, 91, 208, 0.06) 0%, transparent 50%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-geist-mono), monospace',
              color: 'var(--muted)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              padding: '3px 8px',
              borderRadius: '6px',
            }}
          >
            {formattedId}
          </span>
          {renderStatusBadge()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--muted)',
              backgroundColor: 'var(--surface)',
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid var(--line)',
            }}
          >
            Arc Escrow
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 700,
            lineHeight: 1.3,
            color: 'var(--fg)',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </h3>

        <p
          style={{
            fontSize: '13px',
            color: 'var(--muted)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description || 'No description provided.'}
        </p>
      </div>

      {/* Footer Area with Bounty */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div>
          <div className="text-label-micro">Bounty</div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              fontFamily: 'var(--font-geist-mono), monospace',
              color: 'var(--fg)',
              marginTop: '2px',
            }}
          >
            {bounty} <span style={{ fontSize: '11px', color: 'var(--muted)' }}>USDC</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted)',
          }}
        >
          <span>View</span>
          <span style={{ fontSize: '14px' }}>↗</span>
        </div>
      </div>
    </div>
  );
}
