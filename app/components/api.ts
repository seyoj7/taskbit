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
 *   posted → funded → claimed → submitted → approved/rejected → paid/refunded → archived
 */
export type TaskStatus =
  | 'posted'
  | 'funded'
  | 'claimed'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'refunded'
  | 'archived';

export interface Task {
  id: number;
  title: string;
  description: string;
  bounty_usdc: number;
  status: TaskStatus;
  poster_id: number;
  worker_id: number | null;
  proof: string | null;
  rejection_reason: string | null;
  tx_hash: string | null;
  fund_tx_hash: string | null;
  refund_tx_hash: string | null;
  expires_at: string;
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

export async function claimTask(taskId: number, wallet_address: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/claim`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to claim task');
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

export async function submitTaskWork(taskId: number, wallet_address: string, proof: string): Promise<Task> {
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
  return res.json().then(normalizeTaskDates);
}

export async function approveTask(taskId: number, wallet_address: string, tx_hash: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, tx_hash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to approve task');
  }
  return res.json().then(normalizeTaskDates);
}

export async function rejectTask(
  taskId: number,
  wallet_address: string,
  reason?: string
): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/reject`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reject task');
  }
  return res.json().then(normalizeTaskDates);
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
