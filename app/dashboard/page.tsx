'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TaskCard from '../components/TaskCard';
import PostTaskModal from '../components/PostTaskModal';
import { fetchTasks, Task } from '../lib/api';

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

      <main style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '32px 16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Antares Marketplace Hero Banner Card */}
          <section className="antares-card">
            {/* Banner Artwork Area */}
            <div
              style={{
                height: '180px',
                position: 'relative',
                background: 'linear-gradient(135deg, #12160a 0%, #1a220b 40%, #293803 80%, #cef910 100%)',
                overflow: 'hidden',
              }}
            >
              {/* Subtle mesh pattern */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(206, 249, 16, 0.4) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(109, 91, 208, 0.3) 0%, transparent 40%)',
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 60%)',
                }}
              />
            </div>

            {/* Banner Header Info & Avatar */}
            <div
              style={{
                position: 'relative',
                padding: '0 24px 20px 24px',
                marginTop: '-44px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
                
                {/* Left: Avatar & Title */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                  <div
                    style={{
                      width: '88px',
                      height: '88px',
                      borderRadius: '20px',
                      border: '4px solid var(--surface)',
                      backgroundColor: 'var(--surface)',
                      boxShadow: '0 10px 24px rgba(0,0,0,0.3)',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
                      color: 'var(--accent-fg)',
                      fontSize: '36px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ✦
                  </div>

                  <div style={{ marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
                        Taskbit Marketplace
                      </h1>
                      <span
                        title="Verified Contract"
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: '#3080ff',
                          color: 'white',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        ✓
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span className="antares-badge antares-badge-surface">
                        Arc Network
                      </span>
                      <span className="antares-badge antares-badge-lime">
                        USDC Escrow
                      </span>
                      <button
                        onClick={copyContract}
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-geist-mono), monospace',
                          color: 'var(--muted)',
                          backgroundColor: 'var(--surface-2)',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          border: '1px solid var(--line)',
                          cursor: 'pointer',
                        }}
                        title="Copy contract address"
                      >
                        {copied ? 'Copied ✓' : '0x3A2A…503B 📋'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="antares-btn-accent"
                    onClick={() => setIsPostModalOpen(true)}
                  >
                    <span style={{ fontSize: '15px' }}>+</span>
                    <span>Post a Task</span>
                  </button>
                </div>

              </div>
            </div>

            {/* Antares Metrics Stat Bar */}
            <div
              style={{
                borderTop: '1px solid var(--line)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                backgroundColor: 'var(--surface)',
              }}
            >
              <div style={{ padding: '12px 18px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">Total Escrow</div>
                <div style={{ marginTop: '3px', fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-geist-mono), monospace' }}>
                  ${totalBounties.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--muted)' }}>USDC</span>
                </div>
              </div>

              <div style={{ padding: '12px 18px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">Active Tasks</div>
                <div style={{ marginTop: '3px', fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-geist-mono), monospace' }}>
                  {tasks.length}
                </div>
              </div>

              <div style={{ padding: '12px 18px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">Open Bounties</div>
                <div style={{ marginTop: '3px', fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-geist-mono), monospace', color: 'var(--accent)' }}>
                  {openTasksCount}
                </div>
              </div>

              <div style={{ padding: '12px 18px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">24H Activity</div>
                <div style={{ marginTop: '3px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="antares-badge antares-badge-up" style={{ padding: '1px 6px' }}>
                    +14.2% ↑
                  </span>
                </div>
              </div>

              <div style={{ padding: '12px 18px', borderRight: '1px solid var(--line)' }}>
                <div className="text-label-micro">Verification</div>
                <div style={{ marginTop: '3px', fontSize: '14px', fontWeight: 600 }}>
                  GitHub API
                </div>
              </div>

              <div style={{ padding: '12px 18px' }}>
                <div className="text-label-micro">Settlement</div>
                <div style={{ marginTop: '3px', fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>
                  Instant USDC
                </div>
              </div>
            </div>
          </section>

          {/* Search, Filter Tabs, and Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
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
            <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
              <input
                type="text"
                placeholder="Search tasks, keywords…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="antares-input"
                style={{
                  height: '38px',
                  padding: '0 14px 0 36px',
                  fontSize: '13px',
                  borderRadius: '9999px',
                }}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '14px',
                  height: '14px',
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
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: '14px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px auto',
                }}
              />
              Syncing tasks from blockchain &amp; database…
            </div>
          )}

          {error && (
            <div
              className="antares-card"
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--down)',
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && filteredTasks.length === 0 && (
            <div
              className="antares-card"
              style={{
                padding: '64px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✦</div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
                No tasks found
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '340px', margin: '0 auto 20px auto' }}>
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
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
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
