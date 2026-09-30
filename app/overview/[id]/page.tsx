'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ConfirmModal from '../../components/ConfirmModal';
import styles from './overview.module.css';
import {
  fetchTaskById,
  fetchUserById,
  fetchTaskEscrow,
  recordTaskFunding,
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
  const [posterUser, setPosterUser] = useState<User | null>(null);
  const [onchainEscrow, setOnchainEscrow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info' | 'accent';
  } | null>(null);

  const showAlert = (message: string, title: string = 'Notice', variant: 'danger' | 'warning' | 'info' | 'accent' = 'info') => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      variant,
    });
  };

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

      if (fetchedTask.poster_id) {
        try {
          const p = await fetchUserById(fetchedTask.poster_id);
          setPosterUser(p);
        } catch (e) {
          console.warn('Could not fetch poster user details:', e);
        }
      }

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



  const handleSubmitWork = async () => {
    if (!proof) return showAlert("Please provide a valid GitHub PR or proof link.", "Proof Required", "warning");
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
      showAlert(err.message || "Failed to submit work", "Submission Error", "danger");
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
      showAlert(err.reason || err.message || "Failed to fund escrow", "Escrow Funding Error", "danger");
    } finally {
      setIsSubmitting(false);
      setTxStatus(null);
    }
  };

  const handleApproveAndPay = async () => {
    if (!account) return connectWallet();
    if (!task?.worker_id) return showAlert("No worker assigned.", "Action Unavailable", "warning");

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
      showAlert(err.reason || err.message || "Failed to execute escrow transaction", "Escrow Error", "danger");
    } finally {
      setIsSubmitting(false);
      setTxStatus(null);
    }
  };

  const handleRejectClick = () => {
    if (!account) return connectWallet();
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!account) return connectWallet();

    setIsSubmitting(true);
    try {
      await rejectTask(task!.id, account, rejectionReason || undefined);
      setShowRejectModal(false);

      // Auto-refund if task is expired
      const expired = task ? new Date(task.expires_at).getTime() < Date.now() : false;
      if (expired) {
        try {
          setTxStatus("Task expired — processing automatic refund...");
          if (!(window as any).ethereum) throw new Error("No crypto wallet found.");
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const network = await provider.getNetwork();
          if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
            setTxStatus("Switching wallet to Arc Testnet...");
            const switched = await switchToArcTestnet();
            if (!switched) throw new Error("Could not switch to Arc Testnet.");
          }
          const signer = await provider.getSigner();
          const escrow = new ethers.Contract(TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI, signer);

          setTxStatus("Requesting escrow refund in wallet...");
          const refundTx = await escrow.refundTask(task!.id);
          setTxStatus("Waiting for refund confirmation...");
          const receipt = await refundTx.wait();
          const refundTxHash = receipt.hash || refundTx.hash;

          setTxStatus("Recording refund...");
          await refundExpiredTask(task!.id, account, refundTxHash);
        } catch (refundErr: any) {
          console.warn("Auto-refund after rejection failed:", refundErr);
          // Non-blocking: rejection still succeeded, refund can be done manually
        } finally {
          setTxStatus(null);
        }
      }

      await loadTask();
    } catch (err: any) {
      showAlert(err.message || "Failed to reject task", "Rejection Failed", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefundExpired = async () => {
    if (!account) return connectWallet();

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
      let errorMsg = err.reason || err.message || "Failed to refund task";
      // Decode known contract custom errors
      if (err.data === '0xf13ac034') {
        errorMsg = "Cannot refund: the worker has already submitted work on-chain. You must approve or reject the submission.";
      } else if (err.data === '0xa262cd46') {
        errorMsg = "Task has not expired yet. Refund is only available after the deadline.";
      }
      showAlert(errorMsg, "Refund Failed", "danger");
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
        <main className={styles.mainLoading}>
          <div className={styles.spinner} />
          <div className={styles.loadingText}>Loading task details from Arc Escrow…</div>
        </main>
        <Footer />
      </>
    );
  }

  if (error || !task) {
    return (
      <>
        <Navbar />
        <main className={styles.mainError}>
          <div className={`antares-card animate-rise ${styles.errorCard}`}>
            <div className={styles.errorIcon}>✕</div>
            <h2 className={styles.errorTitle}>
              Error Loading Task
            </h2>
            <p className={styles.errorMsg}>
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
  const isTerminal = ['approved', 'paid', 'refunded', 'archived'].includes(task.status);

  const showRefund = Boolean(account && isPoster && ['funded', 'rejected'].includes(task.status));
  const showConnect = Boolean(!account && !isTerminal);
  const showFund = Boolean(account && isPoster && task.status === 'posted');
  const showSubmit = Boolean(account && (
    (task.status === 'funded' && !isPoster && !isExpired) ||
    (task.status === 'rejected' && isWorker && !isExpired)
  ));
  const showApprove = Boolean(account && task.status === 'submitted' && isPoster);
  const showPosterWait = Boolean(account && isPoster && task.status === 'funded' && !isExpired);
  const showTerminal = Boolean(isTerminal);

  const hasActions = showRefund || showConnect || showFund || showSubmit || showApprove || showPosterWait || showTerminal;

  return (
    <>
      <Navbar />

      <main className={styles.mainDetail}>
        <div className={styles.detailContainer}>
          <div className={`animate-rise ${styles.breadcrumbRow}`}>
            <Link href="/marketplace" className={styles.breadcrumbLink}>
              Marketplace
            </Link>
            <span className={styles.breadcrumbSlash}>/</span>
            <span className={styles.breadcrumbActive}>Task #{String(task.id).padStart(4, '0')}</span>
          </div>

          <div className={`antares-card animate-rise ${styles.detailCard}`}>
            <div className={styles.cardInner}>
              <div className={styles.leftSection}>
              {/* Row 1: Badges */}
              <div className={styles.badgeRow}>
                <span className={styles.taskIdInlineBadge}>
                  TASK #{String(task.id).padStart(4, '0')}
                </span>

                <span
                  className={`antares-badge ${getStatusBadgeClass(task.status)} ${styles.statusBadgeInline}`}
                >
                  {getStatusLabel(task.status)}
                </span>
              </div>

              {/* Title */}
              <h1 className={styles.detailTitle}>
                {task.title}
              </h1>

              <div className={styles.metaStrip}>
                <div>
                  <span className={styles.metaLabel}>POSTED BY</span>
                  <div className={styles.metaValueRow}>
                    <span
                      className={(task.poster_wallet_address || posterUser?.wallet_address) ? styles.metaValueMono : styles.metaValueText}
                      title={(task.poster_wallet_address || posterUser?.wallet_address) ? `Poster: ${task.poster_wallet_address || posterUser?.wallet_address}` : undefined}
                    >
                      {(task.poster_wallet_address || posterUser?.wallet_address)
                        ? `${(task.poster_wallet_address || posterUser?.wallet_address)!.slice(0, 6)}…${(task.poster_wallet_address || posterUser?.wallet_address)!.slice(-4)}`
                        : `User #${task.poster_id}`}
                    </span>
                    {(task.poster_wallet_address || posterUser?.wallet_address) && (
                      <button
                        type="button"
                        onClick={() => handleCopyTx(task.poster_wallet_address || posterUser!.wallet_address, 'poster')}
                        title={copiedTx === 'poster' ? 'Copied address!' : `Copy poster address: ${task.poster_wallet_address || posterUser?.wallet_address}`}
                        className={`${styles.copyBtnInline} ${copiedTx === 'poster' ? styles.copyBtnActive : ''}`}
                      >
                        {copiedTx === 'poster' ? (
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {task.worker_id && (
                  <div className={styles.workerBlock}>
                    <span className={styles.metaLabel}>ASSIGNED WORKER</span>
                    <div className={styles.metaValueRow}>
                      <span className={workerUser ? styles.metaValueMono : styles.metaValueText}>
                        {workerUser ? `${workerUser.wallet_address.slice(0, 6)}…${workerUser.wallet_address.slice(-4)}` : `User #${task.worker_id}`}
                      </span>
                      {workerUser?.wallet_address && (
                        <button
                          type="button"
                          onClick={() => handleCopyTx(workerUser.wallet_address, 'worker')}
                          title={copiedTx === 'worker' ? 'Copied address!' : `Copy worker address: ${workerUser.wallet_address}`}
                          className={`${styles.copyBtnInline} ${copiedTx === 'worker' ? styles.copyBtnActive : ''}`}
                        >
                          {copiedTx === 'worker' ? (
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <span className={styles.metaLabel}>ESCROW SECURITY</span>
                  <span className={styles.metaValueAccent}>Arc Contract ✓</span>
                </div>

                <div>
                  <span className={styles.metaLabel}>DEADLINE</span>
                  <span className={isExpired ? styles.deadlineExpired : styles.deadlineActive}>
                    {new Date(task.expires_at).toLocaleString(undefined, { hour12: true })}
                    {isExpired && ' (Expired)'}
                  </span>
                </div>
              </div>

              <div className={styles.descSection}>
                <div className={`text-label-micro ${styles.descLabelMicro}`}>
                  Deliverables &amp; Description
                </div>
                <div className={styles.descContent}>
                  {task.description || 'No detailed instructions provided.'}
                </div>
              </div>

              {/* Submitted proof */}
              {task.proof && (
                <div className={`animate-rise ${styles.proofSection}`}>
                  <div className={styles.proofHeaderRow}>
                    <span className={styles.proofLabel}>
                      SUBMITTED PROOF (GITHUB / PR)
                    </span>
                    <span className={`antares-badge ${styles.proofBadge}`}>
                      {task.status === 'submitted' ? 'Ready for Review' : task.status === 'rejected' ? 'Rejected' : 'Reviewed'}
                    </span>
                  </div>
                  <a
                    href={task.proof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.proofLinkStyled}
                  >
                    {task.proof} ↗
                  </a>
                </div>
              )}

              {/* Rejection reason */}
              {task.rejection_reason && task.status === 'rejected' && (
                <div className={`animate-rise ${styles.rejectionSection}`}>
                  <div className={styles.rejectionLabel}>
                    REJECTION REASON
                  </div>
                  <p className={styles.rejectionText}>
                    {task.rejection_reason}
                  </p>
                </div>
              )}

              </div>

              <div className={styles.rightSection}>
                <div className={styles.escrowHeader}>
                  <span className="text-label-micro">Escrow Settlement</span>
                  {onchainEscrow && onchainEscrow.funded && (
                    <span className={styles.onchainBadge}>
                      {onchainEscrow.completed ? 'On-Chain Settled' : 'On-Chain Funded ✓'}
                    </span>
                  )}
                </div>
                <div className={styles.bountyDisplay}>
                  ${Number(task.bounty_usdc).toFixed(2)}
                  <span className={styles.bountyUnit}>USDC</span>
                </div>

              <dl className={styles.escrowDl}>
                <div className={styles.escrowRow}>
                  <dt className={styles.escrowDt}>Escrow Bounty</dt>
                  <dd className={styles.escrowDd}>
                    ${Number(task.bounty_usdc).toFixed(2)} USDC
                  </dd>
                </div>
                <div className={styles.escrowRowAligned}>
                  <dt className={styles.escrowDt}>On-Chain Deposit</dt>
                  <dd className={onchainEscrow?.funded ? styles.escrowDdUp : styles.escrowDdMuted}>
                    {task.fund_tx_hash ? (
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${task.fund_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View Deposit Tx on Arc Explorer"
                        className={styles.fundedLink}
                      >
                        Funded ✓ <span className={styles.fundedLinkIcon}>↗</span>
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
                <div className={styles.escrowRow}>
                  <dt className={styles.escrowDt}>Protocol Fee</dt>
                  <dd className={styles.escrowDdAccent}>0.0% (Free)</dd>
                </div>
                <div className={styles.escrowRowTotal}>
                  <dt className={styles.escrowDtTotal}>Total Worker Payout</dt>
                  <dd className={styles.escrowDdTotal}>
                    ${Number(task.bounty_usdc).toFixed(2)} USDC
                  </dd>
                </div>
              </dl>

              {/* Transaction status indicator */}
              {txStatus && (
                <div className={styles.txStatusBanner}>
                  <span className={styles.txStatusSpinner} />
                  {txStatus}
                </div>
              )}

              {/* ── Action Buttons ─────────────────────────── */}
              {hasActions && (
                <div className={styles.actionsDivider}>

                  {/* Refund funded task (disabled until expired) */}
                {account && isPoster && ['funded', 'rejected'].includes(task.status) && (
                  <div className={`animate-rise ${styles.actionWrapper}`}>
                    <button
                      className={`antares-btn-surface ${styles.refundBtnStyled} ${!isExpired ? styles.refundBtnDisabled : ''}`}
                      onClick={handleRefundExpired}
                      disabled={isSubmitting || !isExpired}
                    >
                      {isSubmitting ? 'Processing Refund…' : 'Refund Expired Task'}
                    </button>
                  </div>
                )}

                {/* Connect wallet prompt */}
                {!account && !isTerminal && (
                  <div className={styles.connectPromptCenter}>
                    <p className={styles.connectMsg}>
                      Connect your wallet to submit work or interact with escrow.
                    </p>
                    <button
                      className={`antares-btn-accent ${styles.connectBtnFull}`}
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
                      className={`antares-btn-accent ${styles.fundBtnFull}`}
                      onClick={handleFundEscrow}
                      disabled={isSubmitting}
                    >
                      Deposit &amp; Fund Escrow (${Number(task.bounty_usdc).toFixed(2)} USDC)
                    </button>
                  </div>
                )}

                {/* Worker: submit proof (funded = first-come-first-serve, or rejected for resubmission) */}
                {showSubmit && (
                  <div className={`animate-rise ${styles.actionWrapper}`}>
                    <div>
                      <label className={styles.submitLabel}>
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
                      className={`antares-btn-accent ${styles.actionBtn}`}
                      onClick={handleSubmitWork}
                      disabled={isSubmitting || !proof}
                    >
                      {isSubmitting ? 'Submitting…' : task.status === 'rejected' ? 'Resubmit Proof' : 'Submit Proof for Review'}
                    </button>
                  </div>
                )}

                {/* Poster: approve & pay or reject (submitted) */}
                {account && task.status === 'submitted' && isPoster && (
                  <div className={`animate-rise ${styles.actionWrapper}`}>
                    <button
                      className={`antares-btn-accent ${styles.actionBtn}`}
                      onClick={handleApproveAndPay}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (txStatus || 'Processing…') : 'Approve & Release USDC'}
                    </button>
                    <div className={styles.actionWrapper}>
                      <input
                        type="text"
                        placeholder="Optional rejection reason..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className={`antares-input glass ${styles.rejectionInputSpaced}`}
                      />
                      <button
                        className={`antares-btn-surface ${styles.rejectBtn}`}
                        onClick={handleRejectClick}
                        disabled={isSubmitting}
                      >
                        Reject Submission
                      </button>
                    </div>
                  </div>
                )}



                {/* Terminal states */}
                {isTerminal && (
                  <div
                    className={`animate-rise ${styles.terminalBanner} ${task.tx_hash ? styles.terminalBannerPaid : styles.terminalBannerDefault}`}
                  >
                    {task.tx_hash
                      ? '✓ Bounty paid in full via USDC Escrow'
                      : task.refund_tx_hash
                        ? '↩ Escrow refunded to poster'
                        : 'Task archived'}
                  </div>
                )}
              {/* On-chain settlement info */}
              {(task.tx_hash || task.refund_tx_hash) && (
                <div className={styles.txDivider} />
              )}
              {task.tx_hash && (
                <div className={`animate-rise ${styles.settlementBox}`}>
                  <div className={styles.settlementHeader}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ESCROW FUNDS SETTLED ON-CHAIN
                  </div>
                  <div className={styles.settlementTxLabel}>
                    Payment Tx:
                  </div>
                  <div className={`${styles.txHashBox} ${styles.txHashBoxGreen}`}>
                    <span className={styles.txHashText}>
                      {task.tx_hash}
                    </span>
                    <div className={styles.txActions}>
                      <button
                        onClick={() => handleCopyTx(task.tx_hash!, 'payment')}
                        title="Copy Tx Hash"
                        className={`${styles.txCopyBtn} ${copiedTx === 'payment' ? styles.txCopyBtnActive : ''}`}
                      >
                        {copiedTx === 'payment' ? (
                          <>
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span className={styles.txCopiedLabel}>Copied</span>
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
                        className={styles.txExplorerLink}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {task.refund_tx_hash && (
                <div className={`animate-rise ${styles.refundBox}`}>
                  <div className={styles.refundHeader}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ESCROW REFUNDED ON-CHAIN
                  </div>
                  <div className={styles.settlementTxLabel}>
                    Refund Tx:
                  </div>
                  <div className={`${styles.txHashBox} ${styles.txHashBoxRed}`}>
                    <span className={styles.txHashText}>
                      {task.refund_tx_hash}
                    </span>
                    <div className={styles.txActions}>
                      <button
                        onClick={() => handleCopyTx(task.refund_tx_hash!, 'refund')}
                        title="Copy Tx Hash"
                        className={`${styles.txCopyBtn} ${copiedTx === 'refund' ? styles.txCopyBtnActive : ''}`}
                      >
                        {copiedTx === 'refund' ? (
                          <>
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span className={styles.txCopiedLabel}>Copied</span>
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
                        className={styles.txExplorerLink}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}

                </div>
              )}

              <div className={styles.contractInfo}>
                Verified on Arc Testnet · Contract:{' '}
                <a
                  href={`https://explorer.testnet.arc.io/address/${TASK_ESCROW_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contractLink}
                >
                  {TASK_ESCROW_ADDRESS.slice(0,5)}…{TASK_ESCROW_ADDRESS.slice(-4)} ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        </div>
      </main>

      <ConfirmModal
        isOpen={showRejectModal}
        title="Reject Submission"
        message="Are you sure you want to reject this submission? The worker can still resubmit."
        confirmText="Reject"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSubmitting}
        onCancel={() => !isSubmitting && setShowRejectModal(false)}
        onConfirm={handleConfirmReject}
      />

      {alertModal && (
        <ConfirmModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant || 'danger'}
          confirmText="OK"
          cancelText={null}
          onConfirm={() => setAlertModal(null)}
          onCancel={() => setAlertModal(null)}
        />
      )}

      <Footer />
    </>
  );
}
