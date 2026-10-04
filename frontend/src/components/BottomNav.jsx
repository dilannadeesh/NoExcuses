import { Link, useLocation } from "react-router-dom";
import { House, UserRound, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// A standard bottom tab bar: icon + label, the active tab in ink with a thin
// marker. Shown on top-level screens only -- detail screens pin their own
// primary action instead.
export default function BottomNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const items = [
    { to: "/", label: "Home", Icon: House, active: pathname === "/" },
    { to: "/profile", label: "Profile", Icon: UserRound, active: pathname.startsWith("/profile") },
  ];
  if (user?.isAdmin) {
    items.push({ to: "/admin", label: "Admin", Icon: ShieldCheck, active: pathname.startsWith("/admin") });
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md md:max-w-xl">
        {items.map(({ to, label, Icon, active }) => (
          <Link
            key={to}
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-3 text-[11px] font-medium transition ${
              active ? "text-ink" : "text-faint hover:text-muted"
            }`}
          >
            {active && <span className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-ink" />}
            <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
