import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ErrorNote } from "./States";
import { haptic } from "../lib/native";

// In-app account deletion (App Store guideline 5.1.1(v)). Two taps + the
// password, so it can't happen by accident.
export default function DeleteAccountForm({ quiet = false }) {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await deleteAccount(password);
      haptic("success");
      navigate("/login", { replace: true, state: { notice: "Your account has been deleted." } });
    } catch (err) {
      haptic("error");
      setError(err.message);
      setBusy(false);
    }
  };

  if (!open && quiet) {
    // Low-key entry point (Profile page): still plainly labelled and one tap away.
    return (
      <div className="text-center">
        <button type="button" onClick={() => setOpen(true)} className="py-2 text-xs text-faint underline underline-offset-4 hover:text-muted">
          Delete my account
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full !text-loss">
        <Trash2 size={18} /> Delete my account
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3 border border-loss/40 p-5">
      <h2 className="font-display text-xl font-bold italic uppercase text-loss">Delete account</h2>
      <p className="text-sm text-muted">
        This permanently removes your login, name and email. Games you played stay in your group’s history as
        “Deleted player” so everyone’s stats stay right. Groups you own are handed to another member (or removed if
        you’re the only one in them). This can’t be undone.
      </p>
      <label className="block text-sm font-semibold" htmlFor="delete-password">Enter your password to confirm</label>
      <input
        id="delete-password"
        type="password"
        autoComplete="current-password"
        className="input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={() => { setOpen(false); setPassword(""); setError(""); }} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1 !bg-loss !text-onlime" disabled={busy || !password}>
          {busy ? "Deleting…" : "Delete forever"}
        </button>
      </div>
    </form>
  );
}
