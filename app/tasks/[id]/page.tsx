'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { fetchTaskById, claimTask, submitTaskWork, approveTask, rejectTask, deleteTask, Task } from '../../components/api';
import { useWallet } from '../../components/WalletProvider';

export default function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const { account, user, connectWallet } = useWallet();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [proof, setProof] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTask = async () => {
    try {
      const fetchedTask = await fetchTaskById(parseInt(unwrappedParams.id));
      setTask(fetchedTask);
    } catch (err) {
      console.error(err);
      setError("Task not found or backend unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
  }, [unwrappedParams.id]);

  const handleClaim = async () => {
    if (!account) return connectWallet();
    setIsSubmitting(true);
    try {
      await claimTask(task!.id, account);
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to claim task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWork = async () => {
    if (!proof) return alert("Please provide a valid GitHub PR or proof link.");
    if (!account) return connectWallet();
    setIsSubmitting(true);
    try {
      await submitTaskWork(task!.id, account, proof);
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to submit work");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!account) return connectWallet();
    setIsSubmitting(true);
    try {
      await approveTask(task!.id, account, "0xMockTransactionHash12345");
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to approve task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!account) return connectWallet();
    setIsSubmitting(true);
    try {
      await rejectTask(task!.id, account);
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to reject task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!account) return connectWallet();
    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) return;
    setIsSubmitting(true);
    try {
      await deleteTask(task!.id, account);
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message || "Failed to delete task");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', textAlign: 'center', color: 'var(--muted)', flex: 1 }}>
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
          Loading task details from Arc Escrow…
        </main>
        <Footer />
      </>
    );
  }

  if (error || !task) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '600px', margin: '60px auto', padding: '0 24px', textAlign: 'center', flex: 1 }}>
          <div className="antares-card" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--down)', marginBottom: '8px' }}>
              Error Loading Task
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
              {error || "The requested task does not exist or has been removed."}
            </p>
            <Link href="/dashboard" className="antares-btn-surface">
              ← Return to Marketplace
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const isPoster = user?.id === task.poster_id;
  const isWorker = user?.id === task.worker_id;

  return (
    <>
      <Navbar />

      <main style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '32px 16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
            <Link href="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              Marketplace
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--fg)', fontWeight: 600 }}>Task #{task.id}</span>
          </div>

          {/* 2-Column Antares Item View */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* Left Column: Task Overview & Proof Section */}
            <div className="antares-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-geist-mono), monospace',
                      color: 'var(--muted)',
                      backgroundColor: 'var(--surface-2)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--line)',
                      display: 'inline-block',
                      marginBottom: '8px',
                    }}
                  >
                    TASK #{task.id}
                  </span>
                  <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--fg)' }}>
                    {task.title}
                  </h1>
                </div>

                <span
                  className={`antares-badge ${
                    task.status === 'open'
                      ? 'antares-badge-lime'
                      : task.status === 'approved'
                      ? 'antares-badge-up'
                      : 'antares-badge-surface'
                  }`}
                  style={{ textTransform: 'capitalize', fontSize: '12px', padding: '4px 12px' }}
                >
                  {task.status}
                </span>
              </div>

              {/* Poster & Worker Badges */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginTop: '16px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>POSTED BY</span>
                  <span style={{ fontWeight: 600, color: 'var(--fg)' }}>User #{task.poster_id}</span>
                </div>

                {task.worker_id && (
                  <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '16px' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>ASSIGNED WORKER</span>
                    <span style={{ fontWeight: 600, color: 'var(--fg)' }}>User #{task.worker_id}</span>
                  </div>
                )}

                <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '16px' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>ESCROW SECURITY</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Arc Contract ✓</span>
                </div>
              </div>

              {/* Description Body */}
              <div style={{ marginTop: '24px' }}>
                <div className="text-label-micro" style={{ marginBottom: '8px' }}>
                  Deliverables &amp; Description
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: 'var(--fg)',
                    whiteSpace: 'pre-wrap',
                    padding: '16px',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                  }}
                >
                  {task.description || 'No detailed instructions provided.'}
                </div>
              </div>

              {/* Submitted Work Proof Section */}
              {task.proof && (
                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#3080ff' }}>
                      SUBMITTED PROOF (GITHUB / PR)
                    </span>
                    <span className="antares-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3080ff' }}>
                      Ready for Review
                    </span>
                  </div>
                  <a
                    href={task.proof}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--fg)',
                      fontSize: '13px',
                      textDecoration: 'underline',
                      wordBreak: 'break-all',
                    }}
                  >
                    {task.proof} ↗
                  </a>
                </div>
              )}

              {/* Escrow Released Notice */}
              {task.tx_hash && (
                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(22, 163, 74, 0.08)',
                    border: '1px solid rgba(22, 163, 74, 0.25)',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--up)', marginBottom: '4px' }}>
                    ESCROW FUNDS RELEASED ON-CHAIN
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                    Tx: {task.tx_hash}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Escrow & Action Card */}
            <div className="antares-card" style={{ padding: '24px' }}>
              <div className="text-label-micro">Escrow Settlement</div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-geist-mono), monospace',
                  color: 'var(--fg)',
                  marginTop: '4px',
                  marginBottom: '16px',
                }}
              >
                ${task.bounty_usdc}{' '}
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>USDC</span>
              </div>

              {/* Escrow Breakdown Table */}
              <dl
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '13px',
                  borderTop: '1px solid var(--line)',
                  paddingTop: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)' }}>Escrow Bounty</dt>
                  <dd style={{ fontWeight: 600, fontFamily: 'var(--font-geist-mono), monospace' }}>
                    ${task.bounty_usdc} USDC
                  </dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)' }}>Protocol Fee</dt>
                  <dd style={{ color: 'var(--accent)', fontWeight: 600 }}>0.0% (Free)</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)' }}>Network Fee</dt>
                  <dd style={{ color: 'var(--muted)', fontSize: '12px' }}>Paid by caller</dd>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--line)',
                    paddingTop: '12px',
                    fontWeight: 700,
                  }}
                >
                  <dt style={{ color: 'var(--fg)' }}>Total Payout</dt>
                  <dd style={{ color: 'var(--accent)', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '15px' }}>
                    ${task.bounty_usdc} USDC
                  </dd>
                </div>
              </dl>

              {/* Actions Area */}
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
                {!account && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
                      Connect your wallet to claim this task or interact with escrow.
                    </p>
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '44px' }}
                      onClick={connectWallet}
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}

                {account && task.status === 'open' && !isPoster && (
                  <button
                    className="antares-btn-accent"
                    style={{ width: '100%', height: '44px' }}
                    onClick={handleClaim}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Claiming Task…' : 'Claim Task & Begin Work'}
                  </button>
                )}

                {account && task.status === 'claimed' && isWorker && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                      Submit Pull Request / Proof Link
                    </label>
                    <input
                      type="url"
                      placeholder="https://github.com/user/repo/pull/1"
                      value={proof}
                      onChange={(e) => setProof(e.target.value)}
                      className="antares-input"
                    />
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '44px' }}
                      onClick={handleSubmitWork}
                      disabled={isSubmitting || !proof}
                    >
                      {isSubmitting ? 'Submitting…' : 'Submit Proof for Approval'}
                    </button>
                  </div>
                )}

                {account && task.status === 'submitted' && isPoster && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '44px' }}
                      onClick={handleApprove}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Releasing Escrow…' : 'Approve & Release USDC'}
                    </button>
                    <button
                      className="antares-btn-surface"
                      style={{ width: '100%', height: '40px', color: 'var(--down)' }}
                      onClick={handleReject}
                      disabled={isSubmitting}
                    >
                      Reject Proof &amp; Reopen Task
                    </button>
                  </div>
                )}

                {account && isPoster && (task.status === 'open' || task.status === 'rejected') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', padding: '4px' }}>
                      {task.status === 'open'
                        ? 'You posted this task. Awaiting a worker to claim it.'
                        : 'Task was rejected and is open for modification or removal.'}
                    </div>
                    <button
                      className="antares-btn-surface"
                      style={{
                        width: '100%',
                        height: '38px',
                        color: 'var(--down)',
                        borderColor: 'rgba(248, 113, 113, 0.3)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Deleting…' : '🗑 Delete Task'}
                    </button>
                  </div>
                )}

                {task.status === 'approved' && (
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--up)',
                      padding: '10px',
                      backgroundColor: 'rgba(22, 163, 74, 0.08)',
                      borderRadius: '10px',
                    }}
                  >
                    ✓ Bounty paid in full via USDC Escrow
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--line)', paddingTop: '16px', fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
                Verified on Arc Testnet · Contract: 0x3A2A…503B
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
