import type { ReactNode } from 'react';

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true" aria-label="Loading wallpapers">
      {Array.from({ length: count }, (_, i) => <div key={i} className="skeleton aspect-[9/16]" />)}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card mx-auto my-10 max-w-md p-8 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card mx-auto my-10 max-w-md border-sorbet p-6 text-center">
      <p className="text-sm">{message}</p>
      {onRetry && <button className="btn-ghost mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-20" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" /></div>;
}
