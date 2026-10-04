import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import BrandMark, { Wordmark } from "../components/BrandMark";
import TournamentView, { TournamentHero } from "../components/TournamentView";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

// Reached by anyone with the link -- no login. It doubles as the app's shop
// window, so it ends with an invitation to make one of your own.
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
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 pb-3 pt-5 md:max-w-xl">
        <Link to="/" aria-label="NoExcuses Badminton home" className="flex min-w-0 items-center gap-3">
          <BrandMark size={44} />
          <Wordmark className="truncate text-[17px]" />
        </Link>
        <Link to="/login" className="btn h-10 shrink-0 bg-white px-4 text-sm text-ink shadow-card">
          Log in
        </Link>
      </header>

      <Screen>
        {loading ? (
          <LoadingBlock rows={3} />
        ) : error || !tournament ? (
          <ErrorNote>{error || "Tournament not found."}</ErrorNote>
        ) : (
          <>
            <TournamentHero tournament={tournament} />
            <div className="mt-4">
              <TournamentView tournament={tournament} canRecordResults={false} onChanged={() => {}} />
            </div>

            <section className="mt-8 rounded-3xl bg-ink p-6 text-white">
              <p className="text-xl font-extrabold leading-tight tracking-tight">Run your own tournament</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Track games, rank your players and share live results like this one — free to start.
              </p>
              <Link to="/signup" className="btn mt-5 h-12 w-full bg-white px-6 text-ink">
                Create free account
              </Link>
            </section>
          </>
        )}
      </Screen>
    </div>
  );
}
