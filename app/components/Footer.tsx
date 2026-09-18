import Link from 'next/link';

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: '64px',
        borderTop: '1px solid var(--line)',
        backgroundColor: 'var(--surface)',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '40px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '32px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
                fontWeight: 800,
                fontSize: '13px',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              ✦
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em' }}>Taskbit</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, maxWidth: '280px' }}>
            Arc-native Proof-of-Work marketplace with automated escrow release and GitHub PR verification.
          </p>
          <div
            style={{
              marginTop: '12px',
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: '11px',
              color: 'var(--muted)',
            }}
          >
            0x3A2ADe…77503B · Arc Network
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>
            Marketplace
          </div>
          <ul style={{ listStyle: 'none', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <li>
              <Link href="/dashboard" style={{ color: 'var(--fg)' }}>
                All Tasks
              </Link>
            </li>
            <li>
              <Link href="/dashboard" style={{ color: 'var(--muted)' }}>
                Open Bounties
              </Link>
            </li>
            <li>
              <Link href="/dashboard" style={{ color: 'var(--muted)' }}>
                Active Escrows
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>
            Protocol
          </div>
          <ul style={{ listStyle: 'none', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <li>
              <Link href="/" style={{ color: 'var(--fg)' }}>
                About Taskbit
              </Link>
            </li>
            <li>
              <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>
                Smart Escrow Contract ↗
              </a>
            </li>
            <li>
              <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>
                Automated Verification ↗
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>
            Ecosystem
          </div>
          <ul style={{ listStyle: 'none', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <li>
              <a href="https://x.com" target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>
                X / Twitter ↗
              </a>
            </li>
            <li>
              <a href="https://discord.com" target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>
                Discord ↗
              </a>
            </li>
            <li>
              <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>
                Arc Microgrants ↗
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', padding: '16px 24px' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--muted)',
          }}
        >
          <span>© 2026 Taskbit. Arc-native Proof-of-Work Marketplace. All rights reserved.</span>
          <span>Escrow: TaskEscrow.sol · USDC On-Chain</span>
        </div>
      </div>
    </footer>
  );
}
