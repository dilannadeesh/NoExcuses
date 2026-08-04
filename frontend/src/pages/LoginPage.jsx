import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "./AuthLayout";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Log in"
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="text-amber font-semibold">
            Sign up
          </Link>
        </>
      }
    >
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
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate mb-1">Password</label>
          <input
            type="password"
            required
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
          {submitting ? "Logging in…" : "Log in"}
        </button>
        <div className="text-center">
          <Link to="/forgot-password" className="text-xs text-slate hover:text-amber">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
