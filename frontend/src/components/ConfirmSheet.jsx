import { useEffect } from "react";

// A confirmation popup that slides up from the bottom, with big thumb-sized
// buttons. Tapping the dim area or pressing Escape cancels.
export default function ConfirmSheet({ title, children, confirmLabel, cancelLabel = "Cancel", busy = false, error = "", onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/70" onClick={() => !busy && onCancel()} />
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-b-0 border-line bg-surface px-5 pt-6 md:max-w-xl"
        style={{ paddingBottom: "max(30px, env(safe-area-inset-bottom))" }}
      >
        <h2 className="display text-[28px]">{title}</h2>
        <div className="mt-2 text-[15px] leading-relaxed text-muted">{children}</div>
        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
            {error}
          </p>
        )}
        <div className="mt-6 space-y-3">
          <button type="button" className="btn-primary h-[60px] w-full rounded-2xl text-base" disabled={busy} onClick={onConfirm} autoFocus>
            {busy ? "Settling…" : confirmLabel}
          </button>
          <button type="button" className="btn-secondary h-[60px] w-full rounded-2xl" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
