'use client';

import Link from 'next/link';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import styles from './page.module.css';

export default function Home() {
  const [bountySim, setBountySim] = useState(100);

  return (

    <>
      <Navbar />

      <main className={styles.main}>
        
        <div className={styles.heroContainer}>
          
          <section className={styles.heroSection}>
            {/* Hero Headline */}
            <div className={styles.heroLeft}>
              <h1 className={styles.heroTitle}>
                The Web3 native <br/>
                <span className="text-gradient-lime">Proof-of-Work</span> Marketplace
              </h1>
              <p className={styles.heroSubtitle}>
                Post verifiable tasks with a USDC bounty. Builders complete the work and get paid instantly via smart contract escrow.
              </p>
            </div>

            {/* Right Column: Interactive Quick-Action Panel */}
            <div className={`antares-card animate-rise ${styles.actionPanel}`}>
              <div className={styles.actionHeader}>
                <h2 className={styles.actionTitle}>
                  Taskbit App
                </h2>
              </div>

              <p className={styles.actionDesc}>
                Explore open bounties or create your own task to fund directly with USDC escrow.
              </p>

              {/* Bounty Simulator Box */}
              <div className={styles.simBox}>
                <div className={styles.simRow}>
                  <span className={styles.simLabel}>Example Bounty</span>
                  <div className={styles.simControls}>
                    <button
                      onClick={() => setBountySim((prev) => Math.max(25, prev - 25))}
                      className={`antares-icon-btn ${styles.simBtn}`}
                    >
                      −
                    </button>
                    <span className={styles.simValue}>
                      ${bountySim}
                    </span>
                    <button
                      onClick={() => setBountySim((prev) => prev + 25)}
                      className={`antares-icon-btn ${styles.simBtn}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculation Summary Table */}
              <dl className={styles.summaryTable}>
                <div className={styles.summaryRow}>
                  <dt className={styles.summaryDt}>Escrow Deposit</dt>
                  <dd className={styles.summaryDd}>${bountySim} USDC</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt className={styles.summaryDt}>Network Fee</dt>
                  <dd className={styles.summaryDdSmall}>Estimated by wallet (~$0.01)</dd>
                </div>
                <div className={styles.summaryRowTotal}>
                  <dt className={styles.summaryDtTotal}>Settlement to Worker</dt>
                  <dd className={styles.summaryDdTotal}>${bountySim} USDC</dd>
                </div>
              </dl>

              {/* Action Buttons */}
              <div className={styles.actionButtons}>
                <Link
                  href="/marketplace"
                  className={`antares-btn-accent ${styles.actionBtn}`}
                >
                  Explore Task Marketplace ↗
                </Link>

                <Link
                  href="/post-task"
                  className={`antares-btn-surface ${styles.actionBtn}`}
                  style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                  + Post a New Task
                </Link>
              </div>
            </div>
          </section>

          {/* Antares Schedule / Flow Section */}
          <section className={`antares-card animate-rise ${styles.lifecycleSection}`}>
            <div className={styles.lifecycleHeader}>
              <h2 className={styles.lifecycleTitle}>
                Verification Lifecycle
              </h2>
              <span className="antares-badge antares-badge-surface">EVM + Smart Escrow</span>
            </div>

            <div className={styles.lifecycleGrid}>
              {[
                { step: '01', title: 'Post Task & Escrow', desc: 'Poster specifies bounty and locks USDC in the smart contract.' },
                { step: '02', title: 'Claim & Build', desc: 'Worker claims the open task and implements required code/deliverables.' },
                { step: '03', title: 'Submit GitHub Proof', desc: 'Worker submits PR link. API verifies commit & branch status.' },
                { step: '04', title: 'Release USDC', desc: 'Poster verifies output and releases escrowed USDC directly to worker.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`antares-card-interactive ${styles.stepCard}`}
                >
                  <div className={styles.stepBgNumber}>
                    {item.step}
                  </div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepBadge}>
                      STAGE {item.step}
                    </div>
                    <h3 className={styles.stepTitle}>
                      {item.title}
                    </h3>
                    <p className={styles.stepDesc}>
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
    </>
  );
}
