import { Link } from "react-router-dom";
import BrandMark from "../components/BrandMark";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col px-5 pb-10 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <Link to="/" aria-label="NoExcuses Badminton home" className="mx-auto mb-7">
          <BrandMark size={64} />
        </Link>
        <div className="mb-6 text-center">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return <p className="rounded-2xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">{children}</p>;
}

export const linkClass = "font-semibold text-ink underline underline-offset-4";
