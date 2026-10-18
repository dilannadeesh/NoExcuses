import { Link } from "react-router-dom";
import { CalendarClock, Check, ClipboardList, HandCoins, Medal, Share2, Trophy } from "lucide-react";
import BrandMark, { Wordmark } from "../components/BrandMark";
import LiveScoreboardDemo from "../components/LiveScoreboardDemo";

const VIDEO = "https://videos.pexels.com/video-files/8053487/8053487-uhd_2560_1440_25fps.mp4";
const POSTER = (w) =>
  `https://images.pexels.com/videos/8053487/badminton-sport-sport-activity-squash-8053487.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const tile = "bg-lime-soft text-lime ring-1 ring-lime/25";

const FEATURES = [
  {
    title: "Track every game",
    body: "Singles or doubles, set by set. Deuce games are flagged automatically — no more arguing about whether that last set went to deuce.",
    Icon: ClipboardList,
  },
  {
    title: "Split the cost of playing",
    body: "Add the court booking or a new tube of shuttles, pick who's sharing it, and everyone sees exactly what they owe and to whom. One tap to settle up.",
    Icon: HandCoins,
    isNew: true,
  },
  {
    title: "Plan tonight's games",
    body: "Pick who turned up and get a two-hour session of balanced matches. Everyone plays about the same number of games, nobody sits out twice in a row, and partners get mixed up.",
    Icon: CalendarClock,
    isNew: true,
  },
  {
    title: "Three ways to rank players",
    body: "Win percentage, flat points, or a real Elo skill rating that gives more credit for an upset. Your group's owner picks.",
    Icon: Medal,
  },
  {
    title: "Run a real tournament",
    body: "Auto-generated round-robin fixtures, and a public results page you can text to the whole group — no account needed to view it.",
    Icon: Trophy,
  },
  {
    title: "Share it with the group chat",
    body: "Send the night's plan to WhatsApp or Telegram, or post the leaderboard as an image. Plus your own head-to-head record and stats across every group you're in.",
    Icon: Share2,
    isNew: true,
  },
];

const STEPS = [
  { title: "Create a group", body: "Invite your regulars by email. They don't need to sign up first — they claim their spot later." },
  { title: "Plan the night, log the games", body: "Tick who's there, get fair matches for every court, and enter set-by-set scores from your phone courtside." },
  { title: "Settle the scores — and the bill", body: "Rankings and standings update themselves, and the court fees are split so nobody has to chase anyone." },
];

// Illustration of the Owe screen (made-up names and amounts).
function CostSplitPreview() {
  return (
    <div className="card p-5" aria-label="Example: a court booking split between six players">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[15px] font-semibold">Court booking · Tuesday</p>
          <p className="mt-0.5 text-xs text-muted">Paid by Priya · split 6 ways</p>
        </div>
        <div className="text-right">
          <p className="num text-lg font-semibold">$48.00</p>
          <p className="text-xs text-muted">$8.00 each</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 py-4">
        <div className="rounded-xl bg-loss-soft p-3">
          <p className="num text-xl font-semibold text-loss">$8.00</p>
          <p className="mt-1 text-xs font-medium text-muted">You owe</p>
        </div>
        <div className="rounded-xl bg-win-soft p-3">
          <p className="num text-xl font-semibold text-win">$12.50</p>
          <p className="mt-1 text-xs font-medium text-muted">You’re owed</p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        <li className="flex items-center justify-between gap-3 py-3">
          <span className="text-sm">
            You owe <span className="font-semibold">Priya</span> <span className="num font-semibold text-loss">$8.00</span>
          </span>
          <span className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-onlime">Settle up</span>
        </li>
        <li className="flex items-center justify-between gap-3 py-3">
          <span className="text-sm">
            <span className="font-semibold">Wei</span> owes you <span className="num font-semibold text-win">$12.50</span>
          </span>
          <span className="text-xs text-muted">Shuttles</span>
        </li>
      </ul>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen pb-10">
      {/* Hero: real footage on larger screens, a still frame on phones (saves
          data/battery) and for anyone with reduced-motion set. */}
      <section className="relative overflow-hidden rounded-b-3xl border-b border-lime/20 bg-canvas text-ink">
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
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/80 via-[#06240f]/55 to-canvas" />
          <div className="absolute inset-0 bg-[radial-gradient(520px_280px_at_85%_55%,rgba(204,245,60,0.16),transparent_70%)]" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[600px] w-full max-w-5xl flex-col px-5 pb-24 pt-5 sm:min-h-[640px] sm:pb-28">
          <nav className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <BrandMark size={44} />
              <Wordmark className="hidden sm:inline-flex" />
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-lime/40 bg-black/30 px-4 py-2.5 text-sm font-semibold text-lime backdrop-blur transition hover:bg-lime hover:text-onlime"
            >
              Log in
            </Link>
          </nav>

          <div className="mt-auto pt-24">
            <span className="chip border border-lime/30 bg-black/40 uppercase tracking-[0.18em] text-lime backdrop-blur">Free to start</span>
            <h1 className="display mt-4 max-w-xl text-[44px] font-extrabold sm:text-[64px]">
              Your badminton group deserves <span className="text-lime">better than a spreadsheet.</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink/75 sm:text-lg">
              Log every game, rank every player fairly, plan fair matches and split the court fees — five minutes to set up.
            </p>
            <div className="mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row">
              <Link to="/signup" className="btn-primary">
                Create free account
              </Link>
              <Link to="/login" className="btn h-12 border border-white/20 bg-black/30 px-6 text-[15px] text-ink backdrop-blur hover:border-lime/50 hover:text-lime">
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
        <h2 className="display text-[30px]">Everything your group needs</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {FEATURES.map(({ title, body, Icon, isNew }) => (
            <div key={title} className="card flex gap-4 p-5">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tile}`}>
                <Icon size={22} />
              </span>
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-[17px] font-semibold tracking-tight">
                  {title}
                  {isNew && (
                    <span className="rounded-md bg-lime px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-onlime">
                      New
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 w-full max-w-5xl px-5">
        <div className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
          <div>
            <span className="chip border border-lime/30 bg-lime-soft uppercase tracking-[0.18em] text-lime">New</span>
            <h2 className="display mt-3 text-[34px] sm:text-[40px]">
              Who paid for the court? <span className="text-lime">Sorted.</span>
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Every group has someone who books the court and someone who always forgets to pay them back. Now the app
              keeps the tab, right next to the scores.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Add court fees, shuttles or drinks in seconds — split equally between whoever was there",
                "Everyone sees what they owe and who owes them, person by person",
                "Settle up with one tap once you've paid someone back",
                "Every expense and repayment stays on record for the whole group",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check size={18} className="mt-0.5 shrink-0 text-lime" aria-hidden />
                  <span className="text-ink/85">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <CostSplitPreview />
        </div>
      </section>

      <section className="mx-auto mt-12 w-full max-w-5xl px-5">
        <h2 className="display text-[30px]">How it works</h2>
        <div className="card mt-5 divide-y divide-line">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4 p-5">
              <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime text-sm font-bold text-onlime">
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
        <div className="rounded-2xl border border-lime/25 bg-[linear-gradient(135deg,#123a22_0%,#08120c_70%)] p-6 sm:p-9">
          <h2 className="display max-w-xs text-[34px] sm:max-w-md sm:text-[44px]">
            Stop guessing who's winning — <span className="text-lime">and who still owes.</span>
          </h2>
          <p className="mt-2 text-sm text-ink/65">Free to start. Five minutes to set up.</p>
          <Link to="/signup" className="btn-primary mt-6">
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
          <Link to="/terms" className="underline underline-offset-4">Terms</Link>
          <Link to="/support" className="underline underline-offset-4">Support</Link>
          <span>© {new Date().getFullYear()}</span>
        </span>
      </footer>
    </div>
  );
}
