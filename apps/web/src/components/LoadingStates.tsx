import { ReactNode } from 'react';

/** Renders a skeleton loading placeholder matching the card style. */
export function LoadingSkeleton({
  className = '',
  height = 'h-24',
}: {
  className?: string;
  height?: string;
}) {
  return (
    <div className={`card ${height} shimmer rounded-xl ${className}`} />
  );
}

/** Full-page loading spinner. */
export function PageLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-sun-400 animate-spin" />
      <p className="text-sm text-ink-400">{message}</p>
    </div>
  );
}

/** Empty state with icon, message, and optional CTA. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-10 text-center text-ink-300">
      <div className="mx-auto mb-3 text-ink-500">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-ink-400 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
