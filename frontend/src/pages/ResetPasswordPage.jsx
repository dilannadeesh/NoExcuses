import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import AuthLayout, { FormError, linkClass } from "./AuthLayout";

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
      <AuthLayout
        title="Invalid link"
        footer={
          <Link to="/forgot-password" className={linkClass}>
            Request a new one
          </Link>
        }
      >
        <p className="text-center text-sm text-muted">This password reset link is missing its token.</p>
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
    <AuthLayout title="Set a new password" subtitle="Choose something at least 8 characters long.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="label">New password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        <FormError>{error}</FormError>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Saving…" : "Set new password"}
        </button>
      </form>
    </AuthLayout>
  );
}
