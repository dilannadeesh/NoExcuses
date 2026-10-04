import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { api } from "../api";
import AuthLayout, { FormError, linkClass } from "./AuthLayout";

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
        <Link to="/login" className={linkClass}>
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
            <MailCheck size={26} />
          </span>
          <p className="text-sm leading-relaxed text-muted">
            If <span className="font-semibold text-ink">{email}</span> has an account, a reset link is on its way.
            Check your inbox (and spam folder).
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <FormError>{error}</FormError>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
