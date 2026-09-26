import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import TournamentView from "../components/TournamentView";
import logo from "../assets/logo.svg";

export default function PublicTournamentPage() {
  const { slug } = useParams();
  const [tournament, setTournament] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getTournament(slug)
      .then(setTournament)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="NoExcuses Badminton" className="h-8 w-8 object-contain" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl leading-none tracking-wide text-chalk">NO EXCUSES</span>
              <span className="text-[9px] tracking-[0.25em] text-slate mt-0.5">BADMINTON</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {loading ? (
          <p className="text-slate">Loading…</p>
        ) : error || !tournament ? (
          <p className="text-fault text-sm">{error || "Tournament not found."}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-display text-3xl sm:text-4xl leading-none">{tournament.name}</h1>
              <span className="text-[10px] uppercase tracking-wide bg-court/20 text-court-light px-2 py-1 rounded-full">
                {tournament.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-slate text-sm mb-8 capitalize">{tournament.match_type} · round robin</p>
            <TournamentView tournament={tournament} canRecordResults={false} onChanged={() => {}} />
          </>
        )}
      </div>
    </div>
  );
}
