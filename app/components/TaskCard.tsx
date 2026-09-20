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
        <span className="antares-badge antares-badge-lime" style={{ padding: '4px 10px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', boxShadow: '0 0 6px currentColor' }} />
          Open
        </span>
      );
    }
    if (s === 'in progress' || s === 'claimed' || s === 'submitted') {
      return (
        <span className="antares-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 10px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
          {s === 'submitted' ? 'Reviewing' : 'In Progress'}
        </span>
      );
    }
    if (s === 'completed' || s === 'approved') {
      return (
        <span className="antares-badge antares-badge-up" style={{ padding: '4px 10px' }}>
          ✓ Paid
        </span>
      );
    }
    return (
      <span className="antares-badge antares-badge-surface" style={{ padding: '4px 10px' }}>
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
          height: '150px',
          backgroundColor: 'var(--surface-2)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid var(--line)',
          backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(217, 249, 29, 0.08) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(109, 91, 208, 0.06) 0%, transparent 50%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--muted)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              padding: '4px 10px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            }}
          >
            {formattedId}
          </span>
          {renderStatusBadge()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="glass"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--fg)',
              padding: '4px 12px',
              borderRadius: '9999px',
            }}
          >
            Arc Escrow
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3
          style={{
            fontSize: '17px',
            fontWeight: 700,
            lineHeight: 1.4,
            color: 'var(--fg)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </h3>

        <p
          style={{
            fontSize: '14px',
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
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--surface)',
          transition: 'background-color 0.3s ease',
        }}
      >
        <div>
          <div className="text-label-micro">Bounty</div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg)',
              marginTop: '4px',
            }}
          >
            {bounty} <span style={{ fontSize: '13px', color: 'var(--muted)' }}>USDC</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--muted)',
            transition: 'color 0.2s ease',
          }}
        >
          <span>View</span>
          <span style={{ fontSize: '16px' }}>↗</span>
        </div>
      </div>
    </div>
  );
}
