'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PostTaskModal from './components/PostTaskModal';
import { useWallet } from './components/WalletProvider';

export default function Home() {
  const { account, connectWallet } = useWallet();
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [bountySim, setBountySim] = useState(100);
  const [activeSlide, setActiveSlide] = useState(0);

  const SLIDES = [
    {
      title: 'Trustless Escrow',
      desc: 'USDC bounties are locked in Arc Network smart contracts until work is approved.',
      badge: 'Arc Smart Contract',
      accentColor: '#cef910',
    },
    {
      title: 'Automated GitHub Verification',
      desc: 'Workers submit pull requests or commits verified via GitHub API checks.',
      badge: 'Proof-of-Work',
      accentColor: '#60a5fa',
    },
    {
      title: 'Instant USDC Payouts',
      desc: 'Once proof is accepted, funds are immediately released directly to the worker wallet.',
      badge: 'Zero Counterparty Risk',
      accentColor: '#4ade80',
    },
  ];

  // Auto-rotate slides
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [SLIDES.length]);

  return (
    <>
      <Navbar onOpenPostTask={() => setIsPostModalOpen(true)} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '48px 16px', flex: 1 }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
          
          <section
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '48px',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Hero Headline */}
            <div style={{ animation: 'rise 0.8s var(--spring)', flex: '1 1 400px' }}>
              <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: 'var(--fg)', marginBottom: '24px' }}>
                The Web3 native <br/>
                <span className="text-gradient-lime">Proof-of-Work</span> Marketplace
              </h1>
              <p style={{ fontSize: 'clamp(16px, 1.5vw, 20px)', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '500px' }}>
                Post verifiable tasks with a USDC bounty. Builders complete the work and get paid instantly via smart contract escrow.
              </p>
            </div>

            {/* Right Column: Interactive Quick-Action Panel */}
            <div className="antares-card animate-rise" style={{ padding: '24px', animationDelay: '0.2s', width: '100%', flex: '1 1 320px', maxWidth: '440px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--fg)' }}>
                  Taskbit App
                </h2>

              </div>

              <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.6 }}>
                Explore open bounties or create your own task to fund directly with USDC escrow.
              </p>



              {/* Bounty Simulator Box */}
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 600 }}>Example Bounty</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => setBountySim((prev) => Math.max(25, prev - 25))}
                      className="antares-icon-btn"
                      style={{ height: '36px', width: '36px', fontSize: '18px' }}
                    >
                      −
                    </button>
                    <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      ${bountySim}
                    </span>
                    <button
                      onClick={() => setBountySim((prev) => prev + 25)}
                      className="antares-icon-btn"
                      style={{ height: '36px', width: '36px', fontSize: '18px' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculation Summary Table */}
              <dl style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Escrow Deposit</dt>
                  <dd style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>${bountySim} USDC</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Network Fee</dt>
                  <dd style={{ fontSize: '13px', color: 'var(--muted)' }}>Estimated by wallet (~$0.01)</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--line)', paddingTop: '8px', fontWeight: 700 }}>
                  <dt style={{ color: 'var(--fg)' }}>Settlement to Worker</dt>
                  <dd style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '16px' }}>${bountySim} USDC</dd>
                </div>
              </dl>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                <Link
                  href="/dashboard"
                  className="antares-btn-accent"
                  style={{ height: '48px', width: '100%', fontSize: '15px' }}
                >
                  Explore Task Marketplace ↗
                </Link>

                <button
                  onClick={() => setIsPostModalOpen(true)}
                  className="antares-btn-surface"
                  style={{ height: '48px', width: '100%', fontSize: '15px' }}
                >
                  + Post a New Task
                </button>
              </div>
            </div>
          </section>

          {/* Antares Schedule / Flow Section */}
          <section className="antares-card animate-rise" style={{ padding: '32px', animationDelay: '0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--fg)' }}>
                Verification Lifecycle
              </h2>
              <span className="antares-badge antares-badge-surface">EVM + Smart Escrow</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
              }}
            >
              {[
                { step: '01', title: 'Post Task & Escrow', desc: 'Poster specifies bounty and locks USDC in the smart contract.' },
                { step: '02', title: 'Claim & Build', desc: 'Worker claims the open task and implements required code/deliverables.' },
                { step: '03', title: 'Submit GitHub Proof', desc: 'Worker submits PR link. API verifies commit & branch status.' },
                { step: '04', title: 'Release USDC', desc: 'Poster verifies output and releases escrowed USDC directly to worker.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="antares-card-interactive"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: '16px',
                    padding: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '80px', fontWeight: 900, color: 'var(--line)', opacity: 0.3, lineHeight: 1 }}>
                    {item.step}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        marginBottom: '10px',
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      STAGE {item.step}
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', marginBottom: '8px' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      <Footer />

      <PostTaskModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={() => {}}
      />
    </>
  );
}
