import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout, { FormError, linkClass } from "./AuthLayout";
import NativeLogin from "./NativeLogin";
import { haptic, isNativeApp } from "../lib/native";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from || "/";
  const notice = location.state?.notice || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      haptic("error");
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isNativeApp()) {
    return (
      <NativeLogin
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        error={error}
        submitting={submitting}
        onSubmit={handleSubmit}
        notice={notice}
      />
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see your groups, rankings and games."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className={linkClass}>
            Create an account
          </Link>
        </>
      }
    >
      {notice && <p className="mb-4 rounded-xl bg-win-soft px-4 py-3 text-sm text-win" role="status">{notice}</p>}
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
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        <FormError>{error}</FormError>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Logging in…" : "Log in"}
        </button>
        <div className="text-center">
          <Link to="/forgot-password" className="text-sm font-medium text-muted hover:text-ink">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
