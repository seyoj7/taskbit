function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
}

const API_URL = getApiBaseUrl();
const TOKEN_KEY = 'taskbit_auth_token';

/**
 * Task lifecycle statuses:
 *   posted → funded → submitted → approved/rejected → paid/refunded → archived
 */
export type TaskStatus =
  | 'posted'
  | 'funded'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'refunded'
  | 'archived';

export type SubmissionStatus = 'pending' | 'selected' | 'rejected';

export interface Task {
  id: number;
  title: string;
  description: string;
  bounty_usdc: number;
  status: TaskStatus;
  poster_id: number;
  poster_wallet_address: string;
  worker_id: number | null;
  proof: string | null;
  rejection_reason: string | null;
  tx_hash: string | null;
  fund_tx_hash: string | null;
  refund_tx_hash: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  submission_count: number;
}

export interface Submission {
  id: number;
  task_id: number;
  worker_id: number;
  worker_wallet_address: string;
  proof: string;
  status: SubmissionStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The backend stores naive datetimes representing UTC.
 * Pydantic serializes them without a 'Z' suffix, so JS would
 * misinterpret them as local time. This helper ensures UTC.
 */
export function parseUtcDate(dateStr: string): Date {
  if (!dateStr) return new Date(dateStr);
  // If already has timezone info (Z or offset), parse as-is
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  // Naive datetime from API → treat as UTC
  return new Date(dateStr + 'Z');
}

/** Normalize all datetime strings on a Task so they're UTC-suffixed. */
function ensureUtcSuffix(dateStr: string): string {
  if (!dateStr) return dateStr;
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr;
  return dateStr + 'Z';
}

function normalizeTaskDates(task: Task): Task {
  return {
    ...task,
    expires_at: ensureUtcSuffix(task.expires_at),
    created_at: ensureUtcSuffix(task.created_at),
    updated_at: ensureUtcSuffix(task.updated_at),
  };
}

function normalizeSubmissionDates(sub: Submission): Submission {
  return {
    ...sub,
    created_at: ensureUtcSuffix(sub.created_at),
    updated_at: ensureUtcSuffix(sub.updated_at),
  };
}

export interface User {
  id: number;
  wallet_address: string;
  created_at: string;
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function requestAuthChallenge(wallet_address: string): Promise<{ nonce: string; message: string; wallet_address: string }> {
  const res = await fetch(`${API_URL}/users/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address }),
  });
  if (!res.ok) {
    throw new Error('Failed to request authentication challenge');
  }
  return res.json();
}

export async function verifyWalletSignature(
  wallet_address: string,
  signature: string,
  nonce: string
): Promise<{ access_token: string; token_type: string; user: User }> {
  const res = await fetch(`${API_URL}/users/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address, signature, nonce }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Cryptographic signature verification failed');
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function authWallet(wallet_address: string): Promise<User> {
  const res = await fetch(`${API_URL}/users/auth/wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address }),
  });
  if (!res.ok) {
    throw new Error('Failed to authenticate wallet');
  }
  return res.json();
}

export async function fetchUserById(userId: number): Promise<User> {
  const res = await fetch(`${API_URL}/users/${userId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch user');
  }
  return res.json();
}

export async function fetchTasks(status?: string): Promise<Task[]> {
  const url = status ? `${API_URL}/tasks/?task_status=${status}` : `${API_URL}/tasks/`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch tasks');
  }
  const tasks: Task[] = await res.json();
  return tasks.map(normalizeTaskDates);
}

export async function createTask(payload: {
  title: string;
  description: string;
  bounty_usdc: number;
  poster_wallet_address: string;
  fund_tx_hash?: string;
  expires_at: string;
}): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create task');
  }
  return res.json().then(normalizeTaskDates);
}



export async function fetchTaskById(taskId: number): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch task');
  }
  return res.json().then(normalizeTaskDates);
}

export async function fetchTaskEscrow(taskId: number): Promise<{
  task_id: number;
  db_status: string;
  bounty_usdc: number;
  tx_hash: string | null;
  fund_tx_hash: string | null;
  refund_tx_hash: string | null;
  onchain: {
    exists: boolean;
    creator?: string;
    worker?: string | null;
    worker_assigned?: boolean;
    bounty_usdc?: number;
    funded?: boolean;
    completed?: boolean;
    error?: string;
  };
}> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/escrow`);
  if (!res.ok) {
    throw new Error('Failed to fetch escrow status');
  }
  return res.json();
}

export async function recordTaskFunding(
  taskId: number,
  wallet_address: string,
  fund_tx_hash: string
): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/fund`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, fund_tx_hash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to record task funding');
  }
  return res.json().then(normalizeTaskDates);
}

// ── Submissions ─────────────────────────────────────────────

export async function fetchTaskSubmissions(taskId: number): Promise<Submission[]> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/submissions`);
  if (!res.ok) {
    throw new Error('Failed to fetch submissions');
  }
  const subs: Submission[] = await res.json();
  return subs.map(normalizeSubmissionDates);
}

export async function submitTaskWork(taskId: number, wallet_address: string, proof: string): Promise<Submission> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/submit`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, proof }),
  });
  if (!res.ok) {
    let errMsg = 'Failed to submit task work';
    try {
      const errData = await res.json();
      if (errData.detail) errMsg = errData.detail;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json().then(normalizeSubmissionDates);
}

export async function approveTask(
  taskId: number,
  wallet_address: string,
  tx_hash: string,
  submission_id: number
): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, tx_hash, submission_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to approve task');
  }
  return res.json().then(normalizeTaskDates);
}

export async function rejectSubmission(
  taskId: number,
  wallet_address: string,
  submission_id: number,
  reason?: string
): Promise<Submission> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/reject`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, submission_id, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reject submission');
  }
  return res.json().then(normalizeSubmissionDates);
}

export async function refundExpiredTask(
  taskId: number,
  wallet_address: string,
  refund_tx_hash: string
): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/refund`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, refund_tx_hash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to refund expired task');
  }
  return res.json().then(normalizeTaskDates);
}

// ── Poster Reviews ──────────────────────────────────────────

export interface PosterReview {
  id: number;
  submission_id: number;
  reviewer_id: number;
  reviewer_wallet_address: string;
  poster_id: number;
  vote: number;
  comment: string;
  created_at: string;
}

export interface PosterScore {
  poster_wallet_address: string;
  poster_id: number;
  upvotes: number;
  downvotes: number;
  score: number;
  reviews: PosterReview[];
}

export async function submitPosterReview(
  submissionId: number,
  vote: number,
  comment: string
): Promise<PosterReview> {
  const res = await fetch(`${API_URL}/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ vote, comment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit review');
  }
  return res.json();
}

export async function fetchPosterReviews(walletAddress: string): Promise<PosterScore> {
  const res = await fetch(`${API_URL}/users/wallet/${walletAddress}/reviews`);
  if (!res.ok) {
    throw new Error('Failed to fetch poster reviews');
  }
  return res.json();
}

export async function fetchSubmissionReview(submissionId: number): Promise<PosterReview | null> {
  const res = await fetch(`${API_URL}/submissions/${submissionId}/review`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error('Failed to fetch submission review');
  }
  return res.json();
}
