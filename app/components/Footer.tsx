import Image from 'next/image';

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: '64px',
        borderTop: '1px solid var(--line)',
        backgroundColor: 'var(--surface)',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          fontSize: '13px',
          color: 'var(--muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Image src="/taskbit_logo.png" alt="Taskbit" width={24} height={24} style={{ borderRadius: '6px' }} />
          <span style={{ fontWeight: 600, color: 'var(--fg)' }}>Taskbit</span>
          <span>© 2026. All rights reserved.</span>
        </div>
        
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="#" style={{ color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>Twitter</a>
          <a href="#" style={{ color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>Discord</a>
          <a href="#" style={{ color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>GitHub</a>
        </div>
      </div>
    </footer>
  );
}
