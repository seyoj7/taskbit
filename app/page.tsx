'use client';

import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { fetchTasks, Task } from './components/api';
import styles from './page.module.css';

const repSequence = [10, 3, -15, 9, 18, 3, -17, 24, 8, -2, 15, -8, -16];

export default function Home() {
  const [stats, setStats] = useState({
    totalVolume: 0,
    activeCount: 0,
    openCount: 0,
    avgSettlement: '< 2 min',
  });

  useEffect(() => {
    let mounted = true;
    fetchTasks()
      .then((tasks: Task[]) => {
        if (!mounted || !Array.isArray(tasks)) return;
        const total = tasks.reduce((sum, t) => sum + Number(t.bounty_usdc || 0), 0);
        const open = tasks.filter((t) => t.status === 'funded').length;
        const active = tasks.filter((t) => t.status !== 'rejected').length;
        setStats({
          totalVolume: total,
          activeCount: active,
          openCount: open,
          avgSettlement: '< 2 min',
        });
      })
      .catch(() => {
        // Leave at 0 on failure
      });

    return () => {
      mounted = false;
    };
  }, []);

  const [repIndex, setRepIndex] = useState(0);
  const [repText, setRepText] = useState('+10');
  const [isRepDeleting, setIsRepDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const targetNum = repSequence[repIndex];
    const targetStr = targetNum > 0 ? `+${targetNum}` : `${targetNum}`;

    let timer: any;
    if (isRepDeleting) {
      if (repText === '') {
        setIsRepDeleting(false);
        setRepIndex((prev) => (prev + 1) % repSequence.length);
      } else {
        timer = setTimeout(() => {
          if (mounted) setRepText((prev) => prev.slice(0, -1));
        }, 120);
      }
    } else {
      if (repText === targetStr) {
        timer = setTimeout(() => {
          if (mounted) setIsRepDeleting(true);
        }, 2500);
      } else {
        timer = setTimeout(() => {
          if (mounted) setRepText(targetStr.slice(0, repText.length + 1));
        }, 150);
      }
    }
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [repText, isRepDeleting, repIndex]);

  return (

    <>
      <Navbar />

      <main className={styles.main}>

        <div className={styles.heroContainer}>

          <section className={styles.heroSection}>
            <div className={styles.heroLeft}>
              <h1 className={styles.heroTitle}>
                The Web3 native <br />
                <span className="text-gradient-lime">Proof-of-Work</span> Marketplace
              </h1>
              <p className={styles.heroSubtitle}>
                Post verifiable tasks with a USDC bounty. Builders complete the work and get paid instantly via smart contract escrow.
              </p>
            </div>

            <div className={`antares-card animate-rise ${styles.actionPanel}`}>
              <div className={styles.actionHeader}>
                <h2 className={styles.actionTitle}>
                  Protocol Activity
                </h2>
                <p className={styles.actionDesc}>
                  Live microgrant escrow and verifiable task settlements on Arc.
                </p>
              </div>

              <div className={styles.statsGrid}>
                <div className={styles.statBox}>
                  <div className={styles.statTopRow}>
                    <span className={styles.statLabel}>Total Volume</span>
                    <span className={styles.statTag}>USDC</span>
                  </div>
                  <div className={styles.statValueAccent}>
                    ${stats.totalVolume.toLocaleString()}
                  </div>
                  <div className={styles.statSubtext}>
                    Locked in smart contracts
                  </div>
                </div>

                <div className={styles.statBox}>
                  <div className={styles.statTopRow}>
                    <span className={styles.statLabel}>Total Bounties</span>
                    <span className={styles.statTag}>{stats.openCount} Open</span>
                  </div>
                  <div className={styles.statValue}>
                    {stats.activeCount}
                  </div>
                  <div className={styles.statSubtext}>
                    Verifiable builder tasks
                  </div>
                </div>

                <div className={styles.statBox}>
                  <div className={styles.statTopRow}>
                    <span className={styles.statLabel}>Settlement</span>
                  </div>
                  <div className={styles.statValue}>
                    {stats.avgSettlement}
                  </div>
                  <div className={styles.statSubtext}>
                    Instant on proof verify
                  </div>
                </div>

                <div className={styles.statBox}>
                  <div className={styles.statTopRow}>
                    <span className={styles.statLabel}>Network Gas</span>
                  </div>
                  <div className={styles.statValue}>
                    ~$0.01
                  </div>
                  <div className={styles.statSubtext}>
                    Sub-second Arc finality
                  </div>
                </div>
              </div>

              <div className={styles.protocolAssurance}>
                <div className={styles.assuranceRow}>
                  <span className={styles.assuranceKey}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Smart Contract Escrow
                  </span>
                  <span className={styles.assuranceVal}>Open Source</span>
                </div>
                <div className={styles.assuranceRow}>
                  <span className={styles.assuranceKey}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Proof Verification
                  </span>
                  <span className={styles.assuranceVal}>GitHub PR / Commits</span>
                </div>
              </div>
            </div>
          </section>

          <section className={`antares-card animate-rise ${styles.lifecycleSection}`}>
            <div className={styles.lifecycleHeader}>
              <h2 className={styles.lifecycleTitle}>
                Verification Lifecycle
              </h2>
              <span className={`antares-badge antares-badge-surface ${styles.lifecycleBadge}`}>
                EVM + Smart Escrow
              </span>
            </div>

            <div className={styles.lifecycleGrid}>
              {[
                { step: '01', title: 'Post Task & Escrow', desc: 'Creator specifies bounty and locks USDC in the smart contract.' },
                { step: '02', title: 'Submit PR / Proof', desc: 'Multiple workers can submit a GitHub PR link as proof of work before the deadline.' },
                { step: '03', title: 'Review & Select', desc: 'Creator reviews all submissions and selects the best contribution.' },
                { step: '04', title: 'Release USDC', desc: 'Creator approves the selected submission and releases escrowed USDC to the worker.' },
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

          <section className={styles.reputationSection}>
            <div className={styles.reputationLeft}>
              <h2 className={styles.reputationTitle}>Creator earns reputation score in public.</h2>
              <div className={styles.reputationList}>
                <div className={styles.reputationItem}>
                  <h3 className={styles.reputationItemTitle}>Rate every outcome.</h3>
                  <p className={styles.reputationItemSub}>Upvote or downvote with a comment.</p>
                </div>
                <div className={styles.reputationItem}>
                  <h3 className={styles.reputationItemTitle}>One review per submission.</h3>
                  <p className={styles.reputationItemSub}>No spam. No revenge reviews.</p>
                </div>
                <div className={styles.reputationItem}>
                  <h3 className={styles.reputationItemTitle}>Know who pays fairly.</h3>
                  <p className={styles.reputationItemSub}>Score = upvotes minus downvotes.</p>
                </div>
              </div>
            </div>
            <div className={styles.reputationRight}>
              <div className={styles.reputationScoreContainer}>
                <span className={repText.startsWith('-') ? styles.reputationScoreNegative : styles.reputationScorePositive}>
                  {repText || '\u200B'}
                </span>
                <span className={styles.typingCursor}>|</span>
              </div>
              <div className={styles.reputationLabel}>Creator reputation score</div>
            </div>
          </section>

          <section className={styles.ctaSection}>
            <h2 className={styles.ctaTitle}>Ready to start building?</h2>
            <p className={styles.ctaDesc}>
              Join the first Arc-native decentralized marketplace. Post tasks with guaranteed escrow, or start completing bounties today.
            </p>
            <div className={styles.ctaButtonGroup}>
              <a href="/post-task" className={styles.ctaButtonPrimary}>
                Post a Task
              </a>
              <a href="/marketplace" className={styles.ctaButtonSecondary}>
                Explore Bounties
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
