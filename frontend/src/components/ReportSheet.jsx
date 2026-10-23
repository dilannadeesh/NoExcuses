import { useEffect, useState } from "react";
import { api } from "../api";

export const REPORT_REASONS = [
  "Offensive or inappropriate content",
  "Harassment or bullying",
  "Someone added me without asking",
  "Spam or fake account",
  "Something else",
];

// Report a group, a member, or something they entered. Goes to the team, who
// act within 24 hours (App Store guideline 1.2).
export default function ReportSheet({ groupId, groupName, members = [], currentUserId, onClose }) {
  const [reason, setReason] = useState("");
  const [about, setAbout] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) return setError("Pick a reason.");
    setBusy(true);
    setError("");
    try {
      await api.reportContent({
        groupId: Number(groupId),
        reportedUserId: about ? Number(about) : null,
        reason,
        details: details.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const others = members.filter((m) => m.id !== currentUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Report a problem">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/70" onClick={() => !busy && onClose()} />
      <div
        className="relative max-h-[92%] w-full max-w-md overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface px-5 pt-6 md:max-w-xl"
        style={{ paddingBottom: "max(30px, env(safe-area-inset-bottom))" }}
      >
        {sent ? (
          <>
            <h2 className="display text-[28px]">Thanks — we’re on it</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Your report about {groupName} has reached our team. We review every report within 24 hours and remove
              content or people that break our rules. You can also leave the group at any time.
            </p>
            <button type="button" className="btn-primary mt-6 h-[60px] w-full rounded-2xl text-base" onClick={onClose} autoFocus>
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="display text-[28px]">Report a problem</h2>
            <p className="mt-1 text-sm text-muted">In {groupName}. Only our team sees this — not the group.</p>

            <fieldset className="mt-4">
              <legend className="label">What’s wrong?</legend>
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <label key={r} className={`card flex cursor-pointer items-center gap-3 px-4 py-3 text-[15px] ${reason === r ? "ring-2 ring-lime" : ""}`}>
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-[#CCF53C]" />
                    {r}
                  </label>
                ))}
              </div>
            </fieldset>

            {others.length > 0 && (
              <div className="mt-4">
                <label htmlFor="report-about" className="label">Who is it about? (optional)</label>
                <select id="report-about" value={about} onChange={(e) => setAbout(e.target.value)} className="input">
                  <option value="">The group in general</option>
                  {others.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="report-details" className="label">Details (optional)</label>
              <textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                rows={3}
                className="input h-auto py-3"
                placeholder="What happened, and where in the app?"
              />
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-2xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
                {error}
              </p>
            )}
            <div className="mt-5 space-y-3">
              <button type="submit" className="btn-primary h-[60px] w-full rounded-2xl text-base" disabled={busy}>
                {busy ? "Sending…" : "Send report"}
              </button>
              <button type="button" className="btn-secondary h-[60px] w-full rounded-2xl" disabled={busy} onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
