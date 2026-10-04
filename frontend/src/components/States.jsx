// Small shared pieces for the loading / error states every screen needs.
export function LoadingBlock({ rows = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/70" />
      ))}
    </div>
  );
}

export function ErrorNote({ children, className = "" }) {
  if (!children) return null;
  return (
    <p role="alert" className={`rounded-2xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss ${className}`}>
      {children}
    </p>
  );
}
