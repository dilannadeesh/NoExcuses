import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import TournamentView from "../components/TournamentView";

export default function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
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

  const publicUrl = tournament ? `${window.location.origin}/t/${tournament.public_slug}` : "";
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-slate">Loading…</div>;
  if (error || !tournament) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-fault text-sm">{error || "Tournament not found."}</p>
      </div>
    );
  }

  const isOwner = tournament.role === "owner";
  const canRecordResults = ["owner", "member", "admin"].includes(tournament.role);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="font-display text-3xl sm:text-4xl leading-none">{tournament.name}</h1>
        <span className="text-[10px] uppercase tracking-wide bg-court/20 text-court-light px-2 py-1 rounded-full">
          {tournament.status.replace("_", " ")}
        </span>
      </div>
      <p className="text-slate text-sm mb-6 capitalize">{tournament.match_type} · round robin</p>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        {tournament.status === "draft" && isOwner && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-amber text-courtink font-display text-lg tracking-wide px-6 py-2.5 rounded-sm hover:bg-chalk transition-colors disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate fixtures"}
          </button>
        )}
        {tournament.status !== "draft" && (
          <button
            onClick={handleCopyLink}
            className="text-sm border border-white/15 hover:border-amber/60 rounded-sm px-4 py-2 text-slate hover:text-chalk transition-colors"
          >
            {copied ? "Copied!" : "Copy public link"}
          </button>
        )}
      </div>

      {tournament.status === "draft" ? (
        <p className="text-slate text-sm py-6">
          {tournament.entries.length} entries registered.{" "}
          {isOwner
            ? "Generate fixtures to schedule the round-robin and start recording results."
            : "Waiting for the group owner to generate fixtures."}
        </p>
      ) : (
        <TournamentView tournament={tournament} canRecordResults={canRecordResults} onChanged={load} />
      )}

      <button onClick={() => navigate(-1)} className="inline-block mt-8 text-sm text-slate hover:text-amber">
        ← Back
      </button>
    </div>
  );
}
