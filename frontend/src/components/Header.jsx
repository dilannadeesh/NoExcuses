import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import BrandMark, { Wordmark } from "./BrandMark";

// Top-level screens show the brand; detail screens show a back button + title.
// `back` may be a path or a function of the route params.
export default function Header({ title, back, wide = false }) {
  const { user } = useAuth();
  const params = useParams();
  const navigate = useNavigate();
  const backTo = typeof back === "function" ? back(params) : back;
  const backClass =
    "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-ink transition hover:border-lime/40 active:scale-95";

  return (
    <header
      className={`mx-auto flex w-full items-center justify-between gap-3 px-5 pb-3 pt-5 ${
        wide ? "max-w-3xl" : "max-w-md md:max-w-xl"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {back === true ? (
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className={backClass}>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </button>
        ) : backTo ? (
          <Link to={backTo} aria-label="Back" className={backClass}>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </Link>
        ) : (
          <Link to="/" aria-label="Home">
            <BrandMark size={40} />
          </Link>
        )}
        <div className="display min-w-0 truncate text-[22px]">
          {title || <Wordmark />}
        </div>
      </div>
      {user && (
        <Link to="/profile" aria-label="Your profile" className="shrink-0 transition active:scale-95">
          <Avatar name={user.name} size={40} />
        </Link>
      )}
    </header>
  );
}
