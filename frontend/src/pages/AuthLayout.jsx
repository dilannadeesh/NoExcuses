import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <img src={logo} alt="No Excuses" className="h-12 w-12 object-contain" />
        <span className="font-display text-2xl leading-none tracking-wide text-chalk">NO EXCUSES</span>
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
