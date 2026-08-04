import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header({ crumb }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="border-b border-white/5">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="font-display text-3xl leading-none tracking-wide text-chalk hover:text-amber transition-colors"
          >
            SCORE<span className="text-amber">MINE</span>
          </Link>
          {crumb && (
            <>
              <span className="text-slate text-lg">/</span>
              <span className="text-slate font-medium">{crumb}</span>
            </>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate">
              {user.name}
              {user.isAdmin && (
                <span className="ml-2 text-[10px] uppercase tracking-wide bg-amber/15 text-amber px-1.5 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </span>
            <button onClick={handleLogout} className="text-slate hover:text-fault">
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
