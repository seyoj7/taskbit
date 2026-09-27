'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import styles from './overview.module.css';
import {
  fetchTaskById,
  fetchUserById,
  fetchTaskEscrow,
  recordTaskFunding,
  claimTask,
  submitTaskWork,
  approveTask,
  rejectTask,
  refundExpiredTask,
  Task,
  User,
} from '../../components/api';
import { useWallet, ARC_TESTNET_CHAIN_ID } from '../../components/WalletProvider';
import { TASK_ESCROW_ADDRESS, USDC_ADDRESS } from '../../components/contracts';

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

const TASK_ESCROW_ABI = [
  "function createTask(uint256 taskId, uint256 bounty, uint256 expiryTimestamp) external",
  "function createTask(uint256 taskId, address worker, uint256 bounty, uint256 expiryTimestamp) external",
  "function fundTask(uint256 taskId) external",
  "function assignWorker(uint256 taskId, address worker) external",
  "function submitWork(uint256 taskId) external",
  "function releasePayment(uint256 taskId) external",
  "function refundTask(uint256 taskId) external",
  "function getTask(uint256 taskId) external view returns (tuple(address creator, address worker, uint256 bounty, uint256 expiryTimestamp, bool funded, bool completed, bool workSubmitted))"
];

// ── Status display helpers ──────────────────────────────────────

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    posted: 'Posted',
    funded: 'Open',
    claimed: 'Claimed',
    submitted: 'Reviewing',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid',
    refunded: 'Refunded',
    archived: 'Archived',
  };
  return labels[status] || status;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'posted': return 'antares-badge-surface';
    case 'funded': return 'antares-badge-lime';
    case 'claimed': return 'antares-badge-surface';
    case 'submitted': return 'antares-badge-surface';
    case 'approved':
    case 'paid': return 'antares-badge-up';
    case 'rejected': return 'antares-badge-down';
    case 'refunded': return 'antares-badge-surface';
    case 'archived': return 'antares-badge-surface';
    default: return 'antares-badge-surface';
  }
}

export default function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const { account, user, connectWallet, switchToArcTestnet } = useWallet();
  const [task, setTask] = useState<Task | null>(null);
  const [workerUser, setWorkerUser] = useState<User | null>(null);
  const [onchainEscrow, setOnchainEscrow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const handleCopyTx = (txHash: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(txHash);
      setCopiedTx(key);
      setTimeout(() => setCopiedTx(null), 2000);
    }
  };

  const loadTask = async () => {
    try {
      const taskId = parseInt(unwrappedParams.id);
      const fetchedTask = await fetchTaskById(taskId);
      setTask(fetchedTask);

      if (fetchedTask.worker_id) {
        try {
          const w = await fetchUserById(fetchedTask.worker_id);
          setWorkerUser(w);
        } catch (e) {
          console.warn('Could not fetch worker user details:', e);
        }
      }

      try {
        const escrowStatus = await fetchTaskEscrow(taskId);
        setOnchainEscrow(escrowStatus.onchain);
      } catch (e) {
        console.warn('Could not fetch on-chain escrow info:', e);
      }
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

  // ── Lifecycle handlers ──────────────────────────────────────

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
      if (onchainEscrow?.funded) {
        if (!(window as any).ethereum) throw new Error("No crypto wallet found.");
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const escrow = new ethers.Contract(TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI, signer);
        
        try {
          // Submit work on-chain to prevent creator refund
          const submitTx = await escrow.submitWork(task!.id);
          await submitTx.wait();
        } catch (e: any) {
          console.warn("Could not submit on-chain (possibly already submitted or expired): ", e);
        }
      }

      await submitTaskWork(task!.id, account, proof);
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to submit work");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFundEscrow = async () => {
    if (!account) return connectWallet();
    if (!task) return;

    setIsSubmitting(true);
    setTxStatus("Connecting to wallet...");

    try {
      if (!(window as any).ethereum) throw new Error("No crypto wallet found.");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
        setTxStatus("Switching wallet to Arc Testnet (Chain ID 5042002)...");
        const switched = await switchToArcTestnet();
        if (!switched) throw new Error("Taskbit escrow strictly operates on Arc Testnet (Chain ID 5042002).");
      }
      const signer = await provider.getSigner();

      const bountyUnits = BigInt(Math.round(Number(task.bounty_usdc) * 1_000_000));
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const escrow = new ethers.Contract(TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI, signer);

      setTxStatus("Checking USDC allowance...");
      const allowance: bigint = await usdc.allowance(account, TASK_ESCROW_ADDRESS);
      if (allowance < bountyUnits) {
        setTxStatus("Please approve USDC spend in wallet...");
        const approveTx = await usdc.approve(TASK_ESCROW_ADDRESS, bountyUnits);
        setTxStatus("Waiting for USDC approval confirmation...");
        await approveTx.wait();
      }

      let alreadyCreated = false;
      try {
        const t = await escrow.getTask(task.id);
        if (t && t.creator && t.creator !== ethers.ZeroAddress) {
          alreadyCreated = true;
        }
      } catch {
        alreadyCreated = false;
      }

      let finalTxHash = '';
      if (!alreadyCreated) {
        setTxStatus("Registering and Funding task on Arc Escrow...");
        try {
          const expiryTimestamp = Math.floor(new Date(task.expires_at).getTime() / 1000);
          const createTx = await escrow["createTask(uint256,uint256,uint256)"](task.id, bountyUnits, expiryTimestamp);
          setTxStatus("Waiting for transaction confirmation...");
          const receipt = await createTx.wait();
          finalTxHash = receipt?.hash || createTx.hash;
        } catch (createErr: any) {
          if (createErr.code === 'CALL_EXCEPTION' || createErr.message?.includes('missing revert data')) {
            throw new Error(
              `The contract at ${TASK_ESCROW_ADDRESS} does not support open task creation (createTask without upfront worker). Please deploy the updated TaskEscrow contract to Arc Testnet.`
            );
          }
          throw createErr;
        }
      }

      if (finalTxHash) {
        setTxStatus("Updating backend status...");
        await recordTaskFunding(task.id, account, finalTxHash);
      }
      await loadTask();
    } catch (err: any) {
      console.error(err);
      alert(err.reason || err.message || "Failed to fund escrow");
    } finally {
      setIsSubmitting(false);
      setTxStatus(null);
    }
  };

  const handleApproveAndPay = async () => {
    if (!account) return connectWallet();
    if (!task?.worker_id) return alert("No worker assigned.");

    setIsSubmitting(true);
    setTxStatus("Initializing Arc transaction...");

    try {
      if (!(window as any).ethereum) throw new Error("No crypto wallet found.");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
        setTxStatus("Switching wallet to Arc Testnet (Chain ID 5042002)...");
        const switched = await switchToArcTestnet();
        if (!switched) throw new Error("Taskbit escrow strictly operates on Arc Testnet (Chain ID 5042002).");
      }
      const signer = await provider.getSigner();

      const bountyUnits = BigInt(Math.round(Number(task.bounty_usdc) * 1_000_000));
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const escrow = new ethers.Contract(TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI, signer);

      // 1. Ensure task exists and is funded on-chain
      let onchainTask: any = null;
      try {
        onchainTask = await escrow.getTask(task.id);
      } catch (e) {
        onchainTask = null;
      }

      if (!onchainTask || onchainTask.creator === ethers.ZeroAddress) {
        setTxStatus("Checking USDC allowance...");
        const allowance: bigint = await usdc.allowance(account, TASK_ESCROW_ADDRESS);
        if (allowance < bountyUnits) {
          setTxStatus("Approving USDC transfer in wallet...");
          const approveTx = await usdc.approve(TASK_ESCROW_ADDRESS, bountyUnits);
          await approveTx.wait();
        }

        setTxStatus("Registering and Funding task in Escrow...");
        const expiryTimestamp = Math.floor(new Date(task.expires_at).getTime() / 1000);
        const createTx = await escrow["createTask(uint256,uint256,uint256)"](task.id, bountyUnits, expiryTimestamp);
        await createTx.wait();
      }

      // 2. Ensure worker is assigned on-chain
      const targetWorkerWallet = workerUser?.wallet_address;
      if (!targetWorkerWallet) throw new Error("Could not determine assigned worker's wallet address.");

      if (!onchainTask || onchainTask.worker.toLowerCase() !== targetWorkerWallet.toLowerCase()) {
        setTxStatus("Assigning worker to Escrow on-chain...");
        const assignTx = await escrow.assignWorker(task.id, targetWorkerWallet);
        await assignTx.wait();
      }

      // 3. Release payment on-chain
      setTxStatus("Releasing payment to worker on-chain...");
      const releaseTx = await escrow.releasePayment(task.id);
      setTxStatus("Waiting for payment release confirmation...");
      const receipt = await releaseTx.wait();

      const txHash = receipt.hash || releaseTx.hash;

      // 4. Record approval + payment in backend (auto-archives)
      setTxStatus("Recording payment in Taskbit...");
      await approveTask(task.id, account, txHash);
      await loadTask();
    } catch (err: any) {
      console.error(err);
      alert(err.reason || err.message || "Failed to execute escrow transaction");
    } finally {
      setIsSubmitting(false);
      setTxStatus(null);
    }
  };

  const handleReject = async () => {
    if (!account) return connectWallet();
    if (!confirm("Are you sure you want to reject this submission? The worker can still resubmit.")) return;

    setIsSubmitting(true);
    try {
      await rejectTask(task!.id, account, rejectionReason || undefined);
      await loadTask();
    } catch (err: any) {
      alert(err.message || "Failed to reject task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefundExpired = async () => {
    if (!account) return connectWallet();
    if (!confirm("Are you sure you want to refund this expired task and return the USDC bounty?")) return;

    setIsSubmitting(true);
    setTxStatus("Processing refund on Arc Testnet...");

    try {
      if (!(window as any).ethereum) throw new Error("No crypto wallet found.");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
        setTxStatus("Switching wallet to Arc Testnet (Chain ID 5042002)...");
        const switched = await switchToArcTestnet();
        if (!switched) throw new Error("Taskbit escrow strictly operates on Arc Testnet (Chain ID 5042002).");
      }
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI, signer);

      setTxStatus("Requesting Escrow refund transaction in wallet...");
      const refundTx = await escrow.refundTask(task!.id);
      setTxStatus("Waiting for refund confirmation...");
      const receipt = await refundTx.wait();
      const refundTxHash = receipt.hash || refundTx.hash;

      setTxStatus("Updating backend status...");
      await refundExpiredTask(task!.id, account, refundTxHash);
      await loadTask();
    } catch (err: any) {
      console.error(err);
      alert(err.reason || err.message || "Failed to refund task");
    } finally {
      setIsSubmitting(false);
      setTxStatus(null);
    }
  };

  // ── Loading & Error States ──────────────────────────────────

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
  const isExpired = task ? new Date(task.expires_at).getTime() < Date.now() : false;
  const isTerminal = ['paid', 'refunded', 'archived'].includes(task.status);

  const showRefund = Boolean(account && isPoster && isExpired && task.status === 'funded');
  const showConnect = Boolean(!account && !isTerminal);
  const showFund = Boolean(account && isPoster && task.status === 'posted');
  const showClaim = Boolean(account && task.status === 'funded' && !isPoster && !isExpired);
  const showSubmit = Boolean(account && (task.status === 'claimed' || task.status === 'rejected') && isWorker);
  const showApprove = Boolean(account && task.status === 'submitted' && isPoster);
  const showPosterWait = Boolean(account && isPoster && task.status === 'funded' && !isExpired);
  const showTerminal = Boolean(isTerminal);

  const hasActions = showRefund || showConnect || showFund || showClaim || showSubmit || showApprove || showPosterWait || showTerminal;

  return (
    <>
      <Navbar />

      <main style={{ maxWidth: '920px', margin: '0 auto', width: '100%', padding: '40px 16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="animate-rise" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--muted)' }}>
            <Link href="/marketplace" style={{ color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color='var(--fg)'} onMouseLeave={(e) => e.currentTarget.style.color='var(--muted)'}>
              Marketplace
            </Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: 'var(--fg)', fontWeight: 600 }}>Task #{String(task.id).padStart(4, '0')}</span>
          </div>

          <div className="antares-card animate-rise" style={{ padding: '28px', animationDelay: '0.1s' }}>
            <div className={styles.cardInner}>
              <div className={styles.leftSection}>
              {/* Row 1: Badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '24px', marginBottom: '12px' }}>
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
                  }}
                >
                  TASK #{String(task.id).padStart(4, '0')}
                </span>

                <span
                  className={`antares-badge ${getStatusBadgeClass(task.status)}`}
                  style={{ textTransform: 'capitalize', fontSize: '13px', padding: '5px 12px' }}
                >
                  {getStatusLabel(task.status)}
                </span>
              </div>

              {/* Row 2: Title & On-Chain Funded Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg)', lineHeight: 1.2, margin: 0 }}>
                  {task.title}
                </h1>

                {onchainEscrow && onchainEscrow.funded && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--up)',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {onchainEscrow.completed ? 'On-Chain Settled' : 'On-Chain Funded ✓'}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginTop: '18px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>POSTED BY</span>
                  <span style={{ fontWeight: 600, color: 'var(--fg)' }}>User #{task.poster_id}</span>
                </div>

                {task.worker_id && (
                  <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '16px' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>ASSIGNED WORKER</span>
                    <span style={{ fontWeight: 600, color: 'var(--fg)', fontFamily: workerUser ? 'var(--font-mono)' : 'inherit' }}>
                      {workerUser ? `${workerUser.wallet_address.slice(0, 6)}…${workerUser.wallet_address.slice(-4)}` : `User #${task.worker_id}`}
                    </span>
                  </div>
                )}

                <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '16px' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>ESCROW SECURITY</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Arc Contract ✓</span>
                </div>

                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>DEADLINE</span>
                  <span style={{ fontWeight: 600, color: isExpired ? 'var(--down)' : 'var(--fg)' }}>
                    {new Date(task.expires_at).toLocaleString(undefined, { hour12: true })}
                    {isExpired && ' (Expired)'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <div className="text-label-micro" style={{ marginBottom: '8px' }}>
                  Deliverables &amp; Description
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--fg)',
                    whiteSpace: 'pre-wrap',
                    padding: '12px 16px',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                  }}
                >
                  {task.description || 'No detailed instructions provided.'}
                </div>
              </div>

              {/* Submitted proof */}
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
                      {task.status === 'submitted' ? 'Ready for Review' : task.status === 'rejected' ? 'Rejected' : 'Reviewed'}
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

              {/* Rejection reason */}
              {task.rejection_reason && task.status === 'rejected' && (
                <div
                  className="animate-rise"
                  style={{
                    marginTop: '16px',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--down)', marginBottom: '6px', letterSpacing: '0.05em' }}>
                    REJECTION REASON
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--fg)', margin: 0, lineHeight: 1.5 }}>
                    {task.rejection_reason}
                  </p>
                </div>
              )}

              {/* On-chain settlement info */}
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
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--up)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ESCROW FUNDS SETTLED ON-CHAIN
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
                    Payment Tx:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--fg)',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        lineHeight: 1.5,
                      }}
                    >
                      {task.tx_hash}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleCopyTx(task.tx_hash!, 'payment')}
                        title="Copy Tx Hash"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedTx === 'payment' ? 'var(--up)' : 'var(--muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          borderRadius: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {copiedTx === 'payment' ? (
                          <>
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span style={{ fontWeight: 600 }}>Copied</span>
                          </>
                        ) : (
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                      </button>
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${task.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View on Arc Explorer"
                        style={{
                          color: 'var(--muted)',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {task.refund_tx_hash && (
                <div
                  className="animate-rise"
                  style={{
                    marginTop: '16px',
                    padding: '20px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--down)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ESCROW REFUNDED ON-CHAIN
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
                    Refund Tx:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--fg)',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        lineHeight: 1.5,
                      }}
                    >
                      {task.refund_tx_hash}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleCopyTx(task.refund_tx_hash!, 'refund')}
                        title="Copy Tx Hash"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedTx === 'refund' ? 'var(--up)' : 'var(--muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          borderRadius: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {copiedTx === 'refund' ? (
                          <>
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span style={{ fontWeight: 600 }}>Copied</span>
                          </>
                        ) : (
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                      </button>
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${task.refund_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View on Arc Explorer"
                        style={{
                          color: 'var(--muted)',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}
              </div>

              <div className={styles.rightSection}>
                <div style={{ minHeight: '24px', display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="text-label-micro">Escrow Settlement</span>
                </div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--fg)',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px'
                  }}
                >
                  ${Number(task.bounty_usdc).toFixed(2)}
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>USDC</span>
                </div>

              <dl
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  fontSize: '14px',
                  borderTop: '1px solid var(--line)',
                  paddingTop: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Escrow Bounty</dt>
                  <dd style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ${Number(task.bounty_usdc).toFixed(2)} USDC
                  </dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>On-Chain Deposit</dt>
                  <dd style={{ color: onchainEscrow?.funded ? 'var(--up)' : 'var(--muted)', fontWeight: 600 }}>
                    {task.fund_tx_hash ? (
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${task.fund_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View Deposit Tx on Arc Explorer"
                        style={{ color: 'var(--up)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        Funded ✓ <span style={{ fontSize: '10px' }}>↗</span>
                      </a>
                    ) : onchainEscrow?.funded ? (
                      'Funded ✓'
                    ) : task.status === 'posted' ? (
                      'Awaiting Deposit'
                    ) : (
                      'Pending'
                    )}
                  </dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Protocol Fee</dt>
                  <dd style={{ color: 'var(--accent)', fontWeight: 600 }}>0.0% (Free)</dd>
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
                  <dt style={{ color: 'var(--fg)' }}>Total Worker Payout</dt>
                  <dd style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '15px' }}>
                    ${Number(task.bounty_usdc).toFixed(2)} USDC
                  </dd>
                </div>
              </dl>

              {/* Transaction status indicator */}
              {txStatus && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    color: '#60a5fa',
                    fontSize: '13px',
                    marginTop: '20px',
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid #60a5fa',
                      borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                    }}
                  />
                  {txStatus}
                </div>
              )}

              {/* ── Action Buttons ─────────────────────────── */}
              {hasActions && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>

                  {/* Refund expired funded task (no submissions) */}
                {account && isPoster && isExpired && task.status === 'funded' && (
                  <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      className="antares-btn-surface"
                      style={{ width: '100%', height: '44px', color: 'var(--down)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      onClick={handleRefundExpired}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Processing Refund…' : 'Refund Expired Task'}
                    </button>
                  </div>
                )}

                {/* Connect wallet prompt */}
                {!account && !isTerminal && (
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

                {/* Poster: fund the escrow (posted → funded) */}
                {account && isPoster && task.status === 'posted' && (
                  <div>
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '48px', fontSize: '14px' }}
                      onClick={handleFundEscrow}
                      disabled={isSubmitting}
                    >
                      Deposit &amp; Fund Escrow (${Number(task.bounty_usdc).toFixed(2)} USDC)
                    </button>
                  </div>
                )}

                {/* Worker: claim a funded task */}
                {account && task.status === 'funded' && !isPoster && !isExpired && (
                  <button
                    className="antares-btn-accent"
                    style={{ width: '100%', height: '52px', fontSize: '15px' }}
                    onClick={handleClaim}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Claiming Task…' : 'Claim Task & Begin Work'}
                  </button>
                )}

                {/* Worker: submit proof (claimed or rejected for resubmission) */}
                {account && (task.status === 'claimed' || task.status === 'rejected') && isWorker && (
                  <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>
                        {task.status === 'rejected' ? 'Resubmit Pull Request / Proof Link' : 'Submit Pull Request / Proof Link'}
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
                      {isSubmitting ? 'Submitting…' : task.status === 'rejected' ? 'Resubmit Proof' : 'Submit Proof for Approval'}
                    </button>
                  </div>
                )}

                {/* Poster: approve & pay or reject (submitted) */}
                {account && task.status === 'submitted' && isPoster && (
                  <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      className="antares-btn-accent"
                      style={{ width: '100%', height: '52px', fontSize: '15px' }}
                      onClick={handleApproveAndPay}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (txStatus || 'Processing…') : 'Approve & Release USDC'}
                    </button>
                    <div>
                      <input
                        type="text"
                        placeholder="Optional rejection reason..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="antares-input glass"
                        style={{ marginBottom: '8px' }}
                      />
                      <button
                        className="antares-btn-surface"
                        style={{ width: '100%', height: '44px', color: 'var(--down)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        onClick={handleReject}
                        disabled={isSubmitting}
                      >
                        Reject Submission
                      </button>
                    </div>
                  </div>
                )}

                {/* Poster info for posted/funded */}
                {account && isPoster && (task.status === 'funded') && !isExpired && (
                  <div className="animate-rise" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.5 }}>
                    You posted this task. Awaiting a worker to claim it.
                  </div>
                )}

                {/* Terminal states */}
                {isTerminal && (
                  <div
                    className="animate-rise"
                    style={{
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: task.tx_hash ? 'var(--up)' : 'var(--muted)',
                      padding: '16px',
                      backgroundColor: task.tx_hash ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-2)',
                      border: `1px solid ${task.tx_hash ? 'rgba(16, 185, 129, 0.2)' : 'var(--line)'}`,
                      borderRadius: '12px',
                    }}
                  >
                    {task.tx_hash
                      ? '✓ Bounty paid in full via USDC Escrow'
                      : task.refund_tx_hash
                        ? '↩ Escrow refunded to poster'
                        : 'Task archived'}
                  </div>
                )}
                </div>
              )}

              <div style={{ marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '16px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
                Verified on Arc Testnet · Contract: {TASK_ESCROW_ADDRESS.slice(0,6)}…{TASK_ESCROW_ADDRESS.slice(-4)}
              </div>
            </div>
          </div>
        </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
