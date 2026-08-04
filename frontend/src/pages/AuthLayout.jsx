import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <Link to="/" className="font-display text-3xl leading-none tracking-wide mb-8">
        SCORE<span className="text-amber">MINE</span>
      </Link>
      <div className="w-full max-w-sm bg-courtink-2 border border-white/5 rounded-sm px-6 py-7">
        <h1 className="font-display text-2xl mb-1">{title}</h1>
        {subtitle && <p className="text-slate text-sm mb-6">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="mt-5 text-sm text-slate">{footer}</div>}
    </div>
  );
}
