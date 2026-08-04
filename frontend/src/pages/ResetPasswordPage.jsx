import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <AuthLayout title="Invalid link" footer={<Link to="/forgot-password" className="text-amber font-semibold">Request a new one</Link>}>
        <p className="text-sm text-slate">This password reset link is missing its token.</p>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate mb-1">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-courtink border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
          />
        </div>
        {error && <p className="text-fault text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber text-courtink font-display text-lg tracking-wide py-2.5 rounded-sm hover:bg-chalk transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Set new password"}
        </button>
      </form>
    </AuthLayout>
  );
}
