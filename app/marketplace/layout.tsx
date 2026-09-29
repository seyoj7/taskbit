import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace · Taskbit',
  description: 'Browse open bounties, submit proof, and earn USDC on the Taskbit marketplace.',
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
