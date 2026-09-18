'use client';

import Link from 'next/link';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PostTaskModal from './components/PostTaskModal';
import { useWallet } from './context/WalletContext';

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

  return (
    <>
      <Navbar onOpenPostTask={() => setIsPostModalOpen(true)} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '32px 16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Antares 2-Column Showcase Grid */}
          <section
            style={{
              display: 'grid',
              gap: '24px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              alignItems: 'start',
            }}
          >
            {/* Left Column: Collection / Showcase Card */}
            <div className="antares-card">
              {/* Visual Showcase Box */}
              <div
                style={{
                  aspectRatio: '16/10',
                  minHeight: '260px',
                  position: 'relative',
                  backgroundColor: 'var(--surface-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: '24px',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #090a0c 0%, #151d08 45%, #2a370b 80%, #cef910 130%)',
                }}
              >
                {/* Visual Glow */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-30%',
                    right: '-20%',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(206, 249, 16, 0.25) 0%, transparent 70%)',
                    filter: 'blur(30px)',
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 60%)',
                  }}
                />

                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="antares-badge antares-badge-lime">
                      Arc Microgrants
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {SLIDES[activeSlide].badge}
                    </span>
                  </div>

                  <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'white', letterSpacing: '-0.025em' }}>
                    {SLIDES[activeSlide].title}
                  </h1>

                  <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', marginTop: '4px', maxWidth: '440px', lineHeight: 1.45 }}>
                    {SLIDES[activeSlide].desc}
                  </p>
                </div>
              </div>

              {/* Previews / Slides Switcher */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--line)',
                  backgroundColor: 'var(--surface)',
                }}
              >
                {SLIDES.map((slide, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSlide(idx)}
                    style={{
                      height: '44px',
                      flex: 1,
                      borderRadius: '8px',
                      border: activeSlide === idx ? '2px solid var(--accent)' : '1px solid var(--line)',
                      backgroundColor: 'var(--surface-2)',
                      color: activeSlide === idx ? 'var(--fg)' : 'var(--muted)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      padding: '0 8px',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {slide.title}
                  </button>
                ))}
              </div>

              {/* Stats Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  borderTop: '1px solid var(--line)',
                  backgroundColor: 'var(--surface)',
                }}
              >
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--line)' }}>
                  <div className="text-label-micro">Escrow Asset</div>
                  <div style={{ marginTop: '2px', fontSize: '14px', fontWeight: 700, color: 'var(--fg)' }}>USDC</div>
                </div>
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--line)' }}>
                  <div className="text-label-micro">Network</div>
                  <div style={{ marginTop: '2px', fontSize: '14px', fontWeight: 700, color: 'var(--fg)' }}>Arc EVM</div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div className="text-label-micro">Protocol Fee</div>
                  <div style={{ marginTop: '2px', fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>0.0%</div>
                </div>
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', fontSize: '12px', color: 'var(--muted)' }}>
                Built natively for the <strong style={{ color: 'var(--fg)' }}>Arc Microgrants Program</strong> · TaskEscrow.sol
              </div>
            </div>

            {/* Right Column: Interactive Quick-Action Panel (Antares Mint Style) */}
            <div className="antares-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fg)' }}>
                  Taskbit Marketplace
                </h2>
                <span className="antares-badge antares-badge-lime">
                  Active
                </span>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                Post small, verifiable tasks with a USDC bounty. Builders complete tasks and submit proof to release escrow.
              </p>

              {/* Progress Stage Indicator */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  <span style={{ color: 'var(--fg)' }}>Marketplace Protocol Status</span>
                  <span style={{ color: 'var(--accent)' }}>100% Verified</span>
                </div>
                <div style={{ height: '8px', borderRadius: '9999px', backgroundColor: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--accent)' }} />
                </div>
              </div>

              {/* Bounty Simulator Box */}
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>Example Bounty Target</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => setBountySim((prev) => Math.max(25, prev - 25))}
                      className="antares-btn-surface"
                      style={{ height: '32px', width: '32px', padding: 0, fontSize: '16px' }}
                    >
                      −
                    </button>
                    <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-geist-mono), monospace' }}>
                      ${bountySim}
                    </span>
                    <button
                      onClick={() => setBountySim((prev) => prev + 25)}
                      className="antares-btn-surface"
                      style={{ height: '32px', width: '32px', padding: 0, fontSize: '16px' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculation Summary Table */}
              <dl style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)' }}>Escrow Deposit</dt>
                  <dd style={{ fontWeight: 600, fontFamily: 'var(--font-geist-mono), monospace' }}>${bountySim} USDC</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)' }}>Network Fee</dt>
                  <dd style={{ fontSize: '12px', color: 'var(--muted)' }}>Estimated by wallet (~$0.01)</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: '10px', fontWeight: 700 }}>
                  <dt style={{ color: 'var(--fg)' }}>Settlement to Worker</dt>
                  <dd style={{ color: 'var(--accent)', fontFamily: 'var(--font-geist-mono), monospace' }}>${bountySim} USDC</dd>
                </div>
              </dl>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <Link
                  href="/dashboard"
                  className="antares-btn-accent"
                  style={{ height: '44px', width: '100%', fontSize: '14px' }}
                >
                  Explore Task Marketplace ↗
                </Link>

                <button
                  onClick={() => setIsPostModalOpen(true)}
                  className="antares-btn-surface"
                  style={{ height: '44px', width: '100%', fontSize: '14px' }}
                >
                  + Post a New Task with Escrow
                </button>
              </div>

              <p style={{ marginTop: '16px', fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
                Contract: <a href="https://arcscan.io" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>0x3A2ADedbd0f5682a4DDCDeE6a3ef4bf5EB77503B ↗</a>
              </p>
            </div>
          </section>

          {/* Antares Schedule / Flow Section */}
          <section className="antares-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)' }}>
                How Taskbit Works (Verification Lifecycle)
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>EVM + Smart Escrow</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {[
                { step: '01', title: 'Post Task & Escrow', desc: 'Poster specifies bounty and locks USDC in the smart contract.' },
                { step: '02', title: 'Claim & Build', desc: 'Worker claims the open task and implements required code/deliverables.' },
                { step: '03', title: 'Submit GitHub Proof', desc: 'Worker submits PR link. GitHub API verifies commit & branch status.' },
                { step: '04', title: 'Release USDC', desc: 'Poster verifies output and releases escrowed USDC directly to worker.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-geist-mono), monospace',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      marginBottom: '8px',
                    }}
                  >
                    STAGE {item.step}
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--fg)', marginBottom: '4px' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.45 }}>
                    {item.desc}
                  </p>
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
