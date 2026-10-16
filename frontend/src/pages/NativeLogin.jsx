import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { FormError } from "./AuthLayout";

// Log-in screen used only inside the iPhone / Android app (see isNativeApp()).
// Full-bleed hero, big touch targets, and the 60px Log in button pinned to the
// bottom like a native sign-in screen. The website keeps its own card layout.
function CourtLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 420"
      className="pointer-events-none absolute inset-x-0 top-0 h-[420px] w-full text-lime opacity-[0.10]"
      style={{ WebkitMaskImage: "linear-gradient(to bottom, #000 35%, transparent 90%)", maskImage: "linear-gradient(to bottom, #000 35%, transparent 90%)" }}
      preserveAspectRatio="xMidYMin slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="40" y="40" width="320" height="520" rx="4" />
      <line x1="40" y1="170" x2="360" y2="170" />
      <line x1="90" y1="40" x2="90" y2="560" />
      <line x1="310" y1="40" x2="310" y2="560" />
      <line x1="200" y1="40" x2="200" y2="170" />
    </svg>
  );
}

export default function NativeLogin({ email, setEmail, password, setPassword, error, submitting, onSubmit, notice }) {
  const [show, setShow] = useState(false);
  const field =
    "flex h-14 items-center gap-3 rounded-2xl border border-line bg-[#0A110D] px-4 transition focus-within:border-lime/70 focus-within:shadow-glow";
  const inputCls = "h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint outline-none";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-6 pb-48">
      <CourtLines />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-lime/20 blur-[90px]"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-col items-center pt-[max(3.5rem,env(safe-area-inset-top))] text-center">
          <span className="rounded-[28%] shadow-glow">
            <BrandMark size={96} />
          </span>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.42em] text-muted">No Excuses</p>
          <h1 className="display mt-1 text-[44px] font-extrabold text-ink">Badminton</h1>
          <p className="mt-3 max-w-[16rem] text-[15px] leading-snug text-muted">
            Log every game. Rank every player. Settle it on court.
          </p>
        </div>

        <form id="native-login-form" onSubmit={onSubmit} className="mt-10 space-y-3">
          {notice && (
            <p className="rounded-2xl bg-win-soft px-4 py-3 text-sm text-win" role="status">
              {notice}
            </p>
          )}
          <label className={field}>
            <Mail size={20} className="shrink-0 text-faint" />
            <span className="sr-only">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={field}>
            <Lock size={20} className="shrink-0 text-faint" />
            <span className="sr-only">Password</span>
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-faint active:scale-95"
            >
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </label>
          <FormError>{error}</FormError>
          <div className="text-right">
            <Link to="/forgot-password" className="inline-block py-1 text-sm font-semibold text-lime">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>

      <div className="pinned-bar" style={{ background: "linear-gradient(to top, #060A08 70%, rgba(6,10,8,0))", borderTop: 0 }}>
        <div className="mx-auto max-w-md px-6">
          <p className="mb-3 text-center text-sm text-muted">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-ink underline underline-offset-4">
              Create an account
            </Link>
          </p>
          <button type="submit" form="native-login-form" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}
