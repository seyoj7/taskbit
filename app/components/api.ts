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

export interface Task {
  id: number;
  title: string;
  description: string;
  bounty_usdc: number;
  status: 'open' | 'claimed' | 'submitted' | 'approved' | 'rejected';
  poster_id: number;
  worker_id: number | null;
  proof: string | null;
  tx_hash: string | null;
  fund_tx_hash?: string | null;
  created_at: string;
  updated_at: string;
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
  return res.json();
}

export async function createTask(payload: {
  title: string;
  description: string;
  bounty_usdc: number;
  poster_wallet_address: string;
  fund_tx_hash?: string;
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
  return res.json();
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
  return res.json();
}

export async function fetchTaskById(taskId: number): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch task');
  }
  return res.json();
}

export async function fetchTaskEscrow(taskId: number): Promise<{
  task_id: number;
  db_status: string;
  bounty_usdc: number;
  tx_hash: string | null;
  fund_tx_hash: string | null;
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
  return res.json();
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
  return res.json();
}

export async function approveTask(taskId: number, wallet_address: string, tx_hash?: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, tx_hash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to approve task');
  }
  return res.json();
}

export async function rejectTask(
  taskId: number,
  wallet_address: string,
  refund_tx_hash?: string
): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/reject`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address, refund_tx_hash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reject task');
  }
  return res.json();
}

export async function deleteTask(taskId: number, wallet_address: string): Promise<{ message: string; id: number }> {
  const res = await fetch(`${API_URL}/tasks/${taskId}?wallet_address=${encodeURIComponent(wallet_address)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    let errMsg = 'Failed to delete task';
    try {
      const errData = await res.json();
      if (errData.detail) errMsg = errData.detail;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}
