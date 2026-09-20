const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

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
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  wallet_address: string;
  created_at: string;
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

export async function fetchTasks(status?: string): Promise<Task[]> {
  const url = status ? `${API_URL}/tasks/?task_status=${status}` : `${API_URL}/tasks/`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch tasks');
  }
  return res.json();
}

export async function createTask(payload: { title: string; description: string; bounty_usdc: number; poster_wallet_address: string }): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to create task');
  }
  return res.json();
}

export async function claimTask(taskId: number, wallet_address: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/claim`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address }),
  });
  if (!res.ok) {
    throw new Error('Failed to claim task');
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

export async function submitTaskWork(taskId: number, wallet_address: string, proof: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/submit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address, proof }),
  });
  if (!res.ok) {
    let errMsg = 'Failed to submit task work';
    try {
      const errData = await res.json();
      if (errData.detail) errMsg = errData.detail;
    } catch {
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export async function approveTask(taskId: number, wallet_address: string, tx_hash?: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address, tx_hash }),
  });
  if (!res.ok) {
    throw new Error('Failed to approve task');
  }
  return res.json();
}

export async function rejectTask(taskId: number, wallet_address: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address }),
  });
  if (!res.ok) {
    throw new Error('Failed to reject task');
  }
  return res.json();
}

export async function deleteTask(taskId: number, wallet_address: string): Promise<{ message: string; id: number }> {
  const res = await fetch(`${API_URL}/tasks/${taskId}?wallet_address=${encodeURIComponent(wallet_address)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    let errMsg = 'Failed to delete task';
    try {
      const errData = await res.json();
      if (errData.detail) errMsg = errData.detail;
    } catch {
    }
    throw new Error(errMsg);
  }
  return res.json();
}
