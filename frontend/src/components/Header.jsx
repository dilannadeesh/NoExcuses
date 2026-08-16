import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

export default function Header({ crumb }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="No Excuses" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span className="font-display text-xl sm:text-2xl leading-none tracking-wide text-chalk hidden sm:inline">
              NO EXCUSES
            </span>
          </Link>
          {crumb && (
            <>
              <span className="text-slate text-lg shrink-0">/</span>
              <span className="text-slate font-medium truncate">{crumb}</span>
            </>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-1.5 sm:gap-3 text-sm shrink-0 min-w-0">
            <span className="text-slate truncate max-w-[70px] sm:max-w-[160px]">{user.name}</span>
            {user.isAdmin && (
              <span className="shrink-0 text-[10px] uppercase tracking-wide bg-amber/15 text-amber px-1.5 py-0.5 rounded-full">
                Admin
              </span>
            )}
            <button onClick={handleLogout} className="text-slate hover:text-fault whitespace-nowrap shrink-0">
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
