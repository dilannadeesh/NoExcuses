import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "./AuthLayout";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup(name, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="If someone already added you to a group by this email, signing up links you to it automatically."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-amber font-semibold">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate mb-1">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-courtink border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
          />
        </div>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-courtink border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
          />
          <p className="text-xs text-slate mt-1">At least 8 characters.</p>
        </div>
        {error && <p className="text-fault text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber text-courtink font-display text-lg tracking-wide py-2.5 rounded-sm hover:bg-chalk transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthLayout>
  );
}
