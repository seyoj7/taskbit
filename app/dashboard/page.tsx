'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TaskCard from '../components/TaskCard';
import PostTaskModal from '../components/PostTaskModal';
import { fetchTasks, Task } from '../components/api';

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
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [copied, setCopied] = useState(false);

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

  // Aggregate stats
  const totalBounties = useMemo(() => {
    return tasks.reduce((sum, t) => sum + Number(t.bounty_usdc || 0), 0);
  }, [tasks]);

  const openTasksCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'open').length;
  }, [tasks]);

  const copyContract = () => {
    navigator.clipboard.writeText('0x3A2ADedbd0f5682a4DDCDeE6a3ef4bf5EB77503B');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Navbar onOpenPostTask={() => setIsPostModalOpen(true)} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '40px 16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Antares Metrics Stat Bar */}
          <section className="antares-card animate-rise">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                backgroundColor: 'var(--surface-2)',
              }}
            >
              <div style={{ padding: '16px 24px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">Total Escrow</div>
                <div style={{ marginTop: '6px', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  ${totalBounties.toLocaleString()} <span style={{ fontSize: '12px', color: 'var(--muted)' }}>USDC</span>
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">Active Tasks</div>
                <div style={{ marginTop: '6px', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {tasks.length}
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">Open Bounties</div>
                <div style={{ marginTop: '6px', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  {openTasksCount}
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">24H Volume</div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="antares-badge antares-badge-up" style={{ padding: '2px 8px' }}>
                    +14.2% ↑
                  </span>
                </div>
              </div>

              <div style={{ padding: '16px 24px' }}>
                <div className="text-label-micro">Settlement</div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 600, color: 'var(--muted)' }}>
                  Instant USDC
                </div>
              </div>
            </div>
          </section>

          {/* Search, Filter Tabs, and Controls */}
          <div
            className="animate-rise"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              animationDelay: '0.1s',
            }}
          >
            {/* Status Tabs (Segmented Pill Controller) */}
            <div className="antares-nav-pill-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
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

            {/* Search Input */}
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <input
                type="text"
                placeholder="Search tasks, keywords…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="antares-input glass"
                style={{
                  height: '44px',
                  padding: '0 16px 0 42px',
                  fontSize: '14px',
                  borderRadius: '9999px',
                  background: 'var(--surface-2)',
                }}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px',
                  height: '16px',
                  color: 'var(--muted)',
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          {/* Loading, Error, or Task Grid */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)', fontSize: '15px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '3px solid var(--accent)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 16px auto',
                }}
              />
              Syncing marketplace data…
            </div>
          )}

          {error && (
            <div
              className="antares-card animate-rise"
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--down)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ fontWeight: 600 }}>{error}</div>
            </div>
          )}

          {!loading && !error && filteredTasks.length === 0 && (
            <div
              className="antares-card glass animate-rise"
              style={{
                padding: '80px 24px',
                textAlign: 'center',
                background: 'var(--surface-2)',
                borderStyle: 'dashed',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px', filter: 'grayscale(1)', opacity: 0.5 }}>✧</div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: 'var(--fg)' }}>
                No tasks found
              </h3>
              <p style={{ fontSize: '15px', color: 'var(--muted)', maxWidth: '400px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                {searchQuery ? 'Try adjusting your search keywords or filter.' : 'Be the first to post a task and fund it with USDC escrow!'}
              </p>
              <button
                className="antares-btn-accent"
                onClick={() => setIsPostModalOpen(true)}
              >
                + Post a New Task
              </button>
            </div>
          )}

          {!loading && !error && filteredTasks.length > 0 && (
            <div
              className="animate-rise"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '24px',
                animationDelay: '0.2s',
              }}
            >
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

      <PostTaskModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </>
  );
}
