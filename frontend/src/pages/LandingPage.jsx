import { Link } from "react-router-dom";
import { ClipboardList, Medal, Trophy, TrendingUp } from "lucide-react";
import BrandMark, { Wordmark } from "../components/BrandMark";
import LiveScoreboardDemo from "../components/LiveScoreboardDemo";

const VIDEO = "https://videos.pexels.com/video-files/8053487/8053487-uhd_2560_1440_25fps.mp4";
const POSTER = (w) =>
  `https://images.pexels.com/videos/8053487/badminton-sport-sport-activity-squash-8053487.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const FEATURES = [
  {
    title: "Track every game",
    body: "Singles or doubles, set by set. Deuce games are flagged automatically — no more arguing about whether that last set went to deuce.",
    Icon: ClipboardList,
    tile: "bg-soft text-ink",
  },
  {
    title: "Three ways to rank players",
    body: "Win percentage, flat points, or a real Elo skill rating that gives more credit for an upset. Your group's owner picks.",
    Icon: Medal,
    tile: "bg-soft text-ink",
  },
  {
    title: "Run a real tournament",
    body: "Auto-generated round-robin fixtures, and a public results page you can text to the whole group — no account needed to view it.",
    Icon: Trophy,
    tile: "bg-soft text-ink",
  },
  {
    title: "See your own story",
    body: "Your head-to-head record against anyone you've played, and your stats across every group you're in, not just one.",
    Icon: TrendingUp,
    tile: "bg-soft text-ink",
  },
];

const STEPS = [
  { title: "Create a group", body: "Invite your regulars by email. They don't need to sign up first — they claim their spot later." },
  { title: "Log games as you play", body: "Set-by-set scores, singles or doubles, from your phone courtside." },
  { title: "Let it do the rest", body: "Rankings, standings, and tournament brackets update themselves." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen pb-10">
      {/* Hero: real footage on larger screens, a still frame on phones (saves
          data/battery) and for anyone with reduced-motion set. */}
      <section className="relative overflow-hidden rounded-b-3xl bg-ink text-white">
        <div className="absolute inset-0">
          <video
            className="hidden h-full w-full object-cover motion-reduce:hidden sm:block"
            autoPlay
            muted
            loop
            playsInline
            poster={POSTER(1920)}
          >
            <source src={VIDEO} type="video/mp4" />
          </video>
          <div
            className="h-full w-full bg-cover bg-center sm:hidden"
            style={{ backgroundImage: `url('${POSTER(1200)}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/40 to-ink/90" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[600px] w-full max-w-5xl flex-col px-5 pb-24 pt-5 sm:min-h-[640px] sm:pb-28">
          <nav className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <BrandMark size={44} />
              <Wordmark className="hidden text-[17px] sm:inline [&>span]:text-white/60" />
            </Link>
            <Link
              to="/login"
              className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
            >
              Log in
            </Link>
          </nav>

          <div className="mt-auto pt-24">
            <span className="chip bg-white/15 text-white backdrop-blur">Free to start</span>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Your badminton group deserves better than a spreadsheet.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
              Log every game, rank every player fairly, and run a real tournament — five minutes to set up.
            </p>
            <div className="mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row">
              <Link to="/signup" className="btn-primary bg-white text-ink hover:bg-white/90">
                Create free account
              </Link>
              <Link to="/login" className="btn h-12 bg-white/15 px-6 text-[15px] text-white backdrop-blur hover:bg-white/25">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The demo card overlaps the hero edge, like a card sitting on the screen */}
      <div className="relative z-20 mx-auto -mt-14 w-full max-w-md px-5">
        <LiveScoreboardDemo />
      </div>

      <section className="mx-auto mt-12 w-full max-w-5xl px-5">
        <h2 className="text-2xl font-semibold tracking-tight">Everything your group needs</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {FEATURES.map(({ title, body, Icon, tile }) => (
            <div key={title} className="card flex gap-4 p-5">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tile}`}>
                <Icon size={22} />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 w-full max-w-5xl px-5">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="card mt-5 divide-y divide-line">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4 p-5">
              <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 w-full max-w-5xl px-5">
        <div className="rounded-2xl bg-ink p-6 text-white sm:p-9">
          <h2 className="max-w-xs text-2xl font-semibold leading-tight tracking-tight sm:max-w-md sm:text-3xl">
            Stop guessing who's actually winning.
          </h2>
          <p className="mt-2 text-sm text-white/65">Free to start. Five minutes to set up.</p>
          <Link to="/signup" className="btn mt-6 h-12 bg-white px-6 text-[15px] text-ink hover:bg-white/90">
            Create free account
          </Link>
        </div>
      </section>

      <footer className="mx-auto mt-12 flex w-full max-w-5xl items-center justify-between px-5 text-sm text-muted">
        <span className="flex items-center gap-2">
          <BrandMark size={28} />
          NoExcuses Badminton
        </span>
        <span className="flex items-center gap-4">
          <Link to="/privacy" className="underline underline-offset-4">Privacy</Link>
          <span>© {new Date().getFullYear()}</span>
        </span>
      </footer>
    </div>
  );
}
