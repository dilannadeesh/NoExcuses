import { Link, useLocation } from "react-router-dom";
import { House, UserRound, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Floating pill with round icon buttons; the active one goes black. Shown on
// top-level screens only -- detail screens pin their own primary action instead.
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex gap-2 rounded-full bg-white/90 p-2 shadow-float backdrop-blur">
        {items.map(({ to, label, Icon, active }) => (
          <Link
            key={to}
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-95 ${
              active ? "bg-ink text-white" : "bg-soft text-muted hover:text-ink"
            }`}
          >
            <Icon size={22} strokeWidth={2} />
          </Link>
        ))}
      </div>
    </nav>
  );
}
