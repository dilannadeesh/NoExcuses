import { Link } from "react-router-dom";
import logo from "../assets/logo.svg";
import LiveScoreboardDemo from "../components/LiveScoreboardDemo";

const FEATURES = [
  {
    title: "Track every game",
    body: "Singles or doubles, set by set. Deuce games are flagged automatically — no more arguing about whether that last set actually went to deuce.",
    accent: "bg-court-light",
  },
  {
    title: "Three ways to rank players",
    body: "Win percentage, flat points, or a real Elo skill rating that gives more credit for an upset and less for beating someone you were expected to. Your group's owner picks.",
    accent: "bg-amber",
  },
  {
    title: "Run a real tournament",
    body: "Auto-generated round-robin fixtures, and a public results page you can text to the whole group — no account needed to view it.",
    accent: "bg-court-light",
  },
  {
    title: "See your own story",
    body: "Your head-to-head record against anyone you've played, and your stats across every group you're in, not just one.",
    accent: "bg-amber",
  },
];

const STEPS = [
  { n: 1, title: "Create a group", body: "Invite your regulars by email. They don't need to sign up first — inviting them creates a placeholder they claim later." },
  { n: 2, title: "Log games as you play", body: "Set-by-set scores, singles or doubles, from your phone courtside." },
  { n: 3, title: "Let it do the rest", body: "Rankings, standings, and tournament brackets update themselves." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="NoExcuses Badminton" className="h-8 w-8 sm:h-9 sm:w-9 object-contain shrink-0" />
            <span className="hidden sm:flex flex-col leading-none">
              <span className="font-display text-xl sm:text-2xl leading-none tracking-wide text-chalk">
                NO EXCUSES
              </span>
              <span className="text-[9px] tracking-[0.25em] text-slate mt-0.5">BADMINTON</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-5 text-sm shrink-0">
            <Link to="/login" className="text-slate hover:text-chalk transition-colors whitespace-nowrap">
              Log in
            </Link>
            <Link
              to="/signup"
              className="bg-amber text-courtink font-semibold px-3 sm:px-4 py-2 rounded-sm hover:bg-chalk transition-colors whitespace-nowrap"
            >
              Create free account
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Background: real footage on larger screens, a static frame on
              mobile (saves data/battery) and for anyone with reduced-motion
              set, since this is decorative, not essential content. */}
          <div className="absolute inset-0">
            <video
              className="hidden sm:block motion-reduce:hidden w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              poster="https://images.pexels.com/videos/8053487/badminton-sport-sport-activity-squash-8053487.jpeg?auto=compress&cs=tinysrgb&w=1920"
            >
              <source
                src="https://videos.pexels.com/video-files/8053487/8053487-uhd_2560_1440_25fps.mp4"
                type="video/mp4"
              />
            </video>
            <div
              className="sm:hidden w-full h-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.pexels.com/videos/8053487/badminton-sport-sport-activity-squash-8053487.jpeg?auto=compress&cs=tinysrgb&w=1200')",
              }}
            />
            <div className="absolute inset-0 bg-courtink/88" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20">
            <div className="flex flex-col items-center text-center">
              <LiveScoreboardDemo />

              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05] mt-10 max-w-2xl">
                Your badminton group deserves better than a spreadsheet.
              </h1>
              <p className="text-slate text-base sm:text-lg mt-5 max-w-lg">
                Log every game, rank every player fairly, and run a real tournament — free to start, five minutes to
                set up.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                <Link
                  to="/signup"
                  className="bg-amber text-courtink font-display text-lg tracking-wide px-7 py-3 rounded-sm hover:bg-chalk transition-colors"
                >
                  Create free account
                </Link>
                <Link
                  to="/login"
                  className="text-chalk border border-white/15 hover:border-amber/60 font-semibold px-7 py-3 rounded-sm transition-colors"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="grid sm:grid-cols-2 gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="relative bg-courtink-2 border border-white/5 rounded-sm px-6 py-6 overflow-hidden">
                  <div className={`absolute top-0 left-0 h-[3px] w-full ${f.accent}`} />
                  <h3 className="font-display text-2xl mb-2">{f.title}</h3>
                  <p className="text-slate text-sm leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="font-display text-3xl sm:text-4xl mb-10 text-center">How it works</h2>
            <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
              {STEPS.map((s) => (
                <div key={s.n} className="text-center sm:text-left">
                  <div className="scoreboard-digit text-4xl text-amber mb-3">{s.n}</div>
                  <h3 className="font-display text-xl mb-2">{s.title}</h3>
                  <p className="text-slate text-sm leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-white/5 bg-courtink-2">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <h2 className="font-display text-3xl sm:text-4xl mb-4 max-w-xl mx-auto">
              Stop guessing who's actually winning.
            </h2>
            <Link
              to="/signup"
              className="inline-block bg-amber text-courtink font-display text-lg tracking-wide px-7 py-3 rounded-sm hover:bg-chalk transition-colors mt-4"
            >
              Create free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate">
          <div className="flex items-center gap-2">
            <img src={logo} alt="NoExcuses Badminton" className="h-6 w-6 object-contain" />
            <span>NoExcuses Badminton</span>
          </div>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
