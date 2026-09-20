'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TaskCard from '../components/TaskCard';
import { fetchTasks, Task } from '../components/api';
import styles from './dashboard.module.css';
const STATUS_TABS = [
  { label: 'All Tasks', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'claimed' },
  { label: 'Reviewing', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
] as const;

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTasks(activeTab === 'all' ? undefined : activeTab);
        setTasks(data);
      } catch (err) {
        console.error(err);
        setError('Unable to sync tasks. Ensure the FastAPI backend is running.');
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, [activeTab, refreshTrigger]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    });
  }, [tasks, searchQuery]);

  const totalBounties = useMemo(() => {
    return tasks.reduce((sum, t) => sum + Number(t.bounty_usdc || 0), 0);
  }, [tasks]);

  const openTasksCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'open').length;
  }, [tasks]);

  return (
    <>
      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          
          <section className="antares-card animate-rise">
            <div className={styles.statBar}>
              <div className={styles.statItem}>
                <div className="text-label-micro">Total Escrow</div>
                <div className={styles.statValue}>
                  ${totalBounties.toLocaleString()} <span className={styles.statCurrency}>USDC</span>
                </div>
              </div>

              <div className={styles.statItem}>
                <div className="text-label-micro">Active Tasks</div>
                <div className={styles.statValue}>
                  {tasks.length}
                </div>
              </div>

              <div className={styles.statItem}>
                <div className="text-label-micro">Open Bounties</div>
                <div className={styles.statValueAccent}>
                  {openTasksCount}
                </div>
              </div>

              <div className={styles.statItem}>
                <div className="text-label-micro">24H Volume</div>
                <div className={styles.statValueSmall}>
                  <span className={`antares-badge antares-badge-up ${styles.statBadge}`}>
                    +14.2% ↑
                  </span>
                </div>
              </div>

              <div className={styles.statItemLast}>
                <div className="text-label-micro">Settlement</div>
                <div className={styles.statSubtitle}>
                  Instant USDC
                </div>
              </div>
            </div>
          </section>

          <div className={`animate-rise ${styles.filtersContainer}`}>
            <div className={`antares-nav-pill-container ${styles.pillContainer}`}>
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`antares-nav-pill ${activeTab === tab.value ? 'active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.searchWrapper}>
              <input
                type="text"
                placeholder="Search tasks, keywords…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`antares-input glass ${styles.searchInput}`}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={styles.searchIcon}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          {loading && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner} />
              Syncing marketplace data…
            </div>
          )}

          {error && (
            <div className={`antares-card animate-rise ${styles.errorContainer}`}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={styles.errorIcon}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ fontWeight: 600 }}>{error}</div>
            </div>
          )}

          {!loading && !error && filteredTasks.length === 0 && (
            <div className={`antares-card glass animate-rise ${styles.emptyStateContainer}`}>
              <div className={styles.emptyStateIcon}>✧</div>
              <h3 className={styles.emptyStateTitle}>
                No tasks found
              </h3>
              <p className={styles.emptyStateDesc}>
                {searchQuery ? 'Try adjusting your search keywords or filter.' : 'Be the first to post a task and fund it with USDC escrow!'}
              </p>
              <Link
                className="antares-btn-accent"
                href="/post-task"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              >
                + Post a New Task
              </Link>
            </div>
          )}

          {!loading && !error && filteredTasks.length > 0 && (
            <div className={`animate-rise ${styles.taskGrid}`}>
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  description={task.description || 'No description provided.'}
                  bounty={Number(task.bounty_usdc)}
                  status={
                    task.status === 'open'
                      ? 'Open'
                      : task.status === 'claimed'
                      ? 'In Progress'
                      : task.status === 'submitted'
                      ? 'In Progress'
                      : 'Completed'
                  }
                />
              ))}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </>
  );
}
