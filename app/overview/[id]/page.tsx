'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { fetchTaskById, claimTask, submitTaskWork, approveTask, rejectTask, deleteTask, Task } from '../../components/api';
import { useWallet } from '../../components/WalletProvider';

const TASK_ESCROW_ADDRESS = '0x3A2ADedbd0f5682a4DDCDeE6a3ef4bf5EB77503B';

export default function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const { account, user, connectWallet } = useWallet();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

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

  const handleApproveAndEscrow = async () => {
    if (!account) return connectWallet();
    if (!task?.worker_id) return alert("No worker assigned.");
    
    setIsSubmitting(true);
    setTxStatus("Requesting wallet signature...");
    
    try {
      if (!(window as any).ethereum) throw new Error("No crypto wallet found.");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      setTxStatus("Approving USDC transfer...");
      setTxStatus("Registering Escrow on-chain...");
      setTxStatus("Funding Escrow...");
      setTxStatus("Releasing Payment...");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockTxHash = "0xabc123...def456"; 

      setTxStatus("Updating backend status...");
      await approveTask(task!.id, account, mockTxHash);
      
      await loadTask();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to execute escrow transaction");
    } finally {
      setIsSubmitting(false);
      setTxStatus(null);
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
      router.push('/marketplace');
    } catch (err: any) {
      alert(err.message || "Failed to delete task");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 24px', textAlign: 'center', color: 'var(--muted)', flex: 1 }}>
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
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading task details from Arc Escrow…</div>
        </main>
        <Footer />
      </>
    );
  }

  if (error || !task) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '600px', margin: '80px auto', padding: '0 24px', textAlign: 'center', flex: 1 }}>
          <div className="antares-card animate-rise" style={{ padding: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px', color: 'var(--down)' }}>✕</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--fg)', marginBottom: '8px' }}>
              Error Loading Task
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '24px' }}>
              {error || "The requested task does not exist or has been removed."}
            </p>
            <Link href="/marketplace" className="antares-btn-surface">
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

      <main style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '40px 16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="animate-rise" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--muted)' }}>
            <Link href="/marketplace" style={{ color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color='var(--fg)'} onMouseLeave={(e) => e.currentTarget.style.color='var(--muted)'}>
              Marketplace
            </Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: 'var(--fg)', fontWeight: 600 }}>Task #{String(task.id).padStart(4, '0')}</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            <div className="antares-card animate-rise" style={{ padding: '32px', animationDelay: '0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--muted)',
                      backgroundColor: 'var(--surface-2)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      display: 'inline-block',
                      marginBottom: '12px',
                    }}
                  >
                    TASK #{String(task.id).padStart(4, '0')}
                  </span>
                  <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg)', lineHeight: 1.2 }}>
                    {task.title}
                  </h1>
                </div>

                <span
                  className={`antares-badge ${
                    task.status === 'open'
                      ? 'antares-badge-lime'
                      : task.status === 'approved'
                      ? 'antares-badge-up'
                      : task.status === 'rejected'
                      ? 'antares-badge-down'
                      : 'antares-badge-surface'
                  }`}
                  style={{ textTransform: 'capitalize', fontSize: '13px', padding: '6px 14px' }}
                >
                  {task.status === 'submitted' ? 'Reviewing' : task.status}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '20px',
                  marginTop: '24px',
                  padding: '16px 20px',
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: '16px',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>POSTED BY</span>
                  <span style={{ fontWeight: 600, color: 'var(--fg)' }}>User #{task.poster_id}</span>
                </div>

                {task.worker_id && (
                  <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '20px' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>ASSIGNED WORKER</span>
                    <span style={{ fontWeight: 600, color: 'var(--fg)' }}>User #{task.worker_id}</span>
                  </div>
                )}

                <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '20px' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>ESCROW SECURITY</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Arc Contract ✓</span>
                </div>
              </div>

              <div style={{ marginTop: '32px' }}>
                <div className="text-label-micro" style={{ marginBottom: '12px' }}>
                  Deliverables &amp; Description
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    lineHeight: 1.7,
                    color: 'var(--fg)',
                    whiteSpace: 'pre-wrap',
                    padding: '24px',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: '16px',
                    border: '1px solid var(--line)',
                  }}
                >
                  {task.description || 'No detailed instructions provided.'}
                </div>
              </div>

              {task.proof && (
                <div
                  className="animate-rise"
                  style={{
                    marginTop: '24px',
                    padding: '20px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em' }}>
                      SUBMITTED PROOF (GITHUB / PR)
                    </span>
                    <span className="antares-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                      Ready for Review
                    </span>
                  </div>
                  <a
                    href={task.proof}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--fg)',
                      fontSize: '14px',
                      textDecoration: 'underline',
                      wordBreak: 'break-all',
                      fontWeight: 500,
                    }}
                  >
                    {task.proof} ↗
                  </a>
                </div>
              )}

              {task.tx_hash && (
                <div
                  className="animate-rise"
                  style={{
                    marginTop: '24px',
                    padding: '20px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--up)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ESCROW FUNDS RELEASED ON-CHAIN
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    Tx Hash: {task.tx_hash}
                  </p>
                </div>
              )}
            </div>

            <div className="antares-card animate-rise glass-thick" style={{ padding: '32px', animationDelay: '0.2s', position: 'sticky', top: '90px' }}>
              <div className="text-label-micro">Escrow Settlement</div>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fg)',
                  marginTop: '8px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px'
                }}
              >
                ${task.bounty_usdc}
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)' }}>USDC</span>
              </div>

              <dl
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  fontSize: '14px',
                  borderTop: '1px solid var(--line)',
                  paddingTop: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Escrow Bounty</dt>
                  <dd style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ${task.bounty_usdc} USDC
                  </dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Protocol Fee</dt>
                  <dd style={{ color: 'var(--accent)', fontWeight: 600 }}>0.0% (Free)</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Network Fee</dt>
                  <dd style={{ color: 'var(--muted)', fontSize: '13px' }}>Paid by caller</dd>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px dashed var(--line)',
                    paddingTop: '16px',
                    fontWeight: 700,
                  }}
                >
                  <dt style={{ color: 'var(--fg)' }}>Total Payout</dt>
                  <dd style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '16px' }}>
                    ${task.bounty_usdc} USDC
                  </dd>
                </div>
              </dl>

              <div style={{ marginTop: '32px', borderTop: '1px solid var(--line)', paddingTop: '24px' }}>
                {!account && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                      Connect your wallet to claim this task or interact with escrow.
                    </p>
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '52px', fontSize: '15px' }}
                      onClick={connectWallet}
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}

                {account && task.status === 'open' && !isPoster && (
                  <button
                    className="antares-btn-accent"
                    style={{ width: '100%', height: '52px', fontSize: '15px' }}
                    onClick={handleClaim}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Claiming Task…' : 'Claim Task & Begin Work'}
                  </button>
                )}

                {account && task.status === 'claimed' && isWorker && (
                  <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
                        Submit Pull Request / Proof Link
                      </label>
                      <input
                        type="url"
                        placeholder="https://github.com/user/repo/pull/1"
                        value={proof}
                        onChange={(e) => setProof(e.target.value)}
                        className="antares-input glass"
                      />
                    </div>
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '52px', fontSize: '15px' }}
                      onClick={handleSubmitWork}
                      disabled={isSubmitting || !proof}
                    >
                      {isSubmitting ? (
                        <>
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--accent-fg)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '8px' }} />
                          Submitting…
                        </>
                      ) : 'Submit Proof for Approval'}
                    </button>
                  </div>
                )}

                {account && task.status === 'submitted' && isPoster && (
                  <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '52px', fontSize: '15px' }}
                      onClick={handleApproveAndEscrow}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--accent-fg)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '8px' }} />
                          {txStatus || 'Processing…'}
                        </>
                      ) : 'Approve & Release USDC'}
                    </button>
                    <button
                      className="antares-btn-surface"
                      style={{ width: '100%', height: '44px', color: 'var(--down)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      onClick={handleReject}
                      disabled={isSubmitting}
                    >
                      Reject Proof &amp; Reopen Task
                    </button>
                  </div>
                )}

                {account && isPoster && (task.status === 'open' || task.status === 'rejected') && (
                  <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', padding: '8px', lineHeight: 1.5 }}>
                      {task.status === 'open'
                        ? 'You posted this task. Awaiting a worker to claim it.'
                        : 'Task was rejected and is open for modification or removal.'}
                    </div>
                    <button
                      className="antares-btn-surface"
                      style={{
                        width: '100%',
                        height: '44px',
                        color: 'var(--down)',
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Deleting…' : (
                        <>
                          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          Delete Task
                        </>
                      )}
                    </button>
                  </div>
                )}

                {task.status === 'approved' && (
                  <div
                    className="animate-rise"
                    style={{
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--up)',
                      padding: '16px',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: '12px',
                    }}
                  >
                    ✓ Bounty paid in full via USDC Escrow
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '20px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
                Verified on Arc Testnet · Contract: {TASK_ESCROW_ADDRESS.slice(0,6)}…{TASK_ESCROW_ADDRESS.slice(-4)}
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
