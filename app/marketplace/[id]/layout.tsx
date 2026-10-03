import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Task Details · Taskbit',
  description: 'View task details, submit proof, and manage escrow on Taskbit.',
};

export default function TaskDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
