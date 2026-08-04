import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AuthLayout from "./AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={!sent ? "We'll email you a link to set a new password." : undefined}
      footer={
        <Link to="/login" className="text-amber font-semibold">
          Back to login
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-chalk">
          If <span className="font-semibold">{email}</span> has an account, a reset link is on its way. Check your
          inbox (and spam folder).
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-courtink border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
            />
          </div>
          {error && <p className="text-fault text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber text-courtink font-display text-lg tracking-wide py-2.5 rounded-sm hover:bg-chalk transition-colors disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
