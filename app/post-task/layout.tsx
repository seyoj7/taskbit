import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Post a Task · Taskbit',
  description: 'Create a new task with a USDC bounty escrowed on Arc Testnet.',
};

export default function PostTaskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
