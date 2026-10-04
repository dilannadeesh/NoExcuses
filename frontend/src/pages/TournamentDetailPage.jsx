import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Link2 } from "lucide-react";
import { api } from "../api";
import TournamentView, { TournamentHero } from "../components/TournamentView";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

export default function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api.getTournament(tournamentId);
      setTournament(t);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const t = await api.generateFixtures(tournamentId);
      setTournament(t);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/t/${tournament.public_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard needs https / a user gesture; fall back to something copyable
      window.prompt("Copy this link", url);
    }
  };

  if (loading) return <Screen><LoadingBlock rows={3} /></Screen>;
  if (error || !tournament) {
    return (
      <Screen>
        <ErrorNote>{error || "Tournament not found."}</ErrorNote>
      </Screen>
    );
  }

  const isOwner = tournament.role === "owner";
  const canRecordResults = ["owner", "member", "admin"].includes(tournament.role);

  return (
    <Screen>
      <TournamentHero tournament={tournament}>
        {tournament.status !== "draft" && (
          <button onClick={handleCopyLink} className="btn-secondary mt-4 w-full">
            {copied ? (
              <>
                <Check size={18} /> Link copied
              </>
            ) : (
              <>
                <Link2 size={18} /> Copy public link
              </>
            )}
          </button>
        )}
      </TournamentHero>

      <div className="mt-4">
        {tournament.status === "draft" ? (
          <section className="rounded-3xl bg-blush p-6">
            <p className="text-lg font-extrabold leading-snug tracking-tight">
              {tournament.entries.length} entries registered
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/70">
              {isOwner
                ? "Generate fixtures to schedule the round-robin and start recording results."
                : "Waiting for the group owner to generate fixtures."}
            </p>
            {isOwner && (
              <button onClick={handleGenerate} disabled={generating} className="btn-primary mt-5 w-full">
                {generating ? "Generating…" : "Generate fixtures"}
              </button>
            )}
          </section>
        ) : (
          <TournamentView tournament={tournament} canRecordResults={canRecordResults} onChanged={load} />
        )}
      </div>
    </Screen>
  );
}
