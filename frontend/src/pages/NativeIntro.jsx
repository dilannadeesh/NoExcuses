import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ClipboardList, HandCoins, Share2 } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { haptic } from "../lib/native";

// First-launch intro, shown once inside the iPhone / Android app before the
// log-in screen (LoginPage decides). Four swipeable slides that sum up what
// the app does; Skip or the last slide's buttons end it for good.

const SEEN_KEY = "ne.intro.v1";

export function introSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode: the intro just shows again next time */
  }
}

// ---- small illustrations, drawn with the app's own tokens ----------------

function Panel({ children }) {
  return (
    <div className="w-full max-w-[300px] rounded-3xl border border-line bg-[linear-gradient(160deg,#13281a_0%,#0b120e_80%)] p-4 shadow-card">
      {children}
    </div>
  );
}

function ScoresArt() {
  const sets = [
    ["21", "19", false],
    ["18", "21", false],
    ["22", "20", true],
  ];
  return (
    <Panel>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold">Priya &amp; Alex</span>
        <span className="chip bg-win-soft text-win">Won 2–1</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">vs Wei &amp; Sam · Doubles</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {sets.map(([a, b, deuce], i) => (
          <div key={i} className="rounded-xl bg-[#0A110D] px-2 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted">Set {i + 1}</p>
            <p className="num mt-0.5 text-lg font-bold">
              {a}<span className="text-faint">–</span>{b}
            </p>
            {deuce && <p className="mt-0.5 text-[10px] font-bold uppercase text-lime">Deuce</p>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-lime-soft px-3 py-2 text-[13px]">
        <span className="font-semibold">1. Priya</span>
        <span className="num text-lime">Elo 1,084 ▲</span>
      </div>
    </Panel>
  );
}

function PlanArt() {
  const courts = [
    ["Court 1", "Priya · Wei", "Alex · Noor"],
    ["Court 2", "Sam · Dilan", "Mei · Raj"],
  ];
  return (
    <Panel>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">Round 1 · 8 players</p>
      <div className="mt-3 space-y-2">
        {courts.map(([c, a, b]) => (
          <div key={c} className="rounded-xl bg-[#0A110D] px-3 py-2.5">
            <p className="text-[11px] text-muted">{c}</p>
            <p className="mt-0.5 flex items-center justify-between text-[13px] font-semibold">
              <span>{a}</span>
              <span className="text-faint">vs</span>
              <span>{b}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Resting: nobody twice in a row</p>
    </Panel>
  );
}

function CostArt() {
  return (
    <Panel>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold">Court booking</p>
          <p className="text-xs text-muted">Paid by Priya · 6 ways</p>
        </div>
        <p className="num text-lg font-bold">$48.00</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-loss-soft p-2.5">
          <p className="num text-base font-bold text-loss">$8.00</p>
          <p className="text-[11px] text-muted">You owe</p>
        </div>
        <div className="rounded-xl bg-win-soft p-2.5">
          <p className="num text-base font-bold text-win">$12.50</p>
          <p className="text-[11px] text-muted">You’re owed</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px]">
        <span>
          You owe <b>Priya</b>
        </span>
        <span className="rounded-lg bg-lime px-2.5 py-1 text-xs font-bold text-onlime">Settle up</span>
      </div>
    </Panel>
  );
}

function ShareArt() {
  const podium = [
    ["Alex", "h-12", "#B4C0CC", "2"],
    ["Priya", "h-16", "#F5B73B", "1"],
    ["Wei", "h-9", "#D58A4B", "3"],
  ];
  return (
    <Panel>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">Tuesday Crew · Leaderboard</p>
      <div className="mt-3 grid grid-cols-3 items-end gap-2 text-center">
        {podium.map(([n, h, c, r]) => (
          <div key={n}>
            <p className="text-[12px] font-semibold">{n}</p>
            <div className={`mt-1 ${h} grid place-items-center rounded-t-lg rounded-b-sm text-sm font-bold`} style={{ background: `${c}26`, color: c }}>
              {r}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2 text-[12px] font-semibold">
        <span className="flex-1 rounded-lg bg-[#0A110D] py-2 text-center">WhatsApp</span>
        <span className="flex-1 rounded-lg bg-[#0A110D] py-2 text-center">Telegram</span>
        <span className="flex-1 rounded-lg bg-[#0A110D] py-2 text-center">Image</span>
      </div>
    </Panel>
  );
}

const SLIDES = [
  {
    Icon: ClipboardList,
    title: "Settle who’s best",
    body: "Log singles or doubles set by set. Rankings update themselves: win %, points or Elo.",
    Art: ScoresArt,
  },
  {
    Icon: CalendarClock,
    title: "Fair games every night",
    body: "Tick who turned up and get balanced matches for every court. Nobody sits out twice.",
    Art: PlanArt,
  },
  {
    Icon: HandCoins,
    title: "Split the court fee",
    body: "Add the booking or shuttles and everyone sees what they owe. One tap to settle up.",
    Art: CostArt,
  },
  {
    Icon: Share2,
    title: "Share it with the group",
    body: "Send tonight’s plan to WhatsApp, post the leaderboard, and run round-robin tournaments.",
    Art: ShareArt,
  },
];

export default function NativeIntro({ onDone }) {
  const navigate = useNavigate();
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  // Keep the dots in step with swipes.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIndex((prev) => (prev === i ? prev : i));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (i) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
    haptic("tap");
  };

  const finish = (to) => {
    markSeen();
    if (to === "signup") navigate("/signup");
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-canvas pb-[max(30px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]"
      role="region"
      aria-roledescription="carousel"
      aria-label="What NoExcuses does"
    >
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-lime/15 blur-[90px]" />

      <div className="relative flex items-center justify-between px-6">
        <span className="flex items-center gap-2">
          <BrandMark size={32} />
          <span className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted">No Excuses</span>
        </span>
        {/* Kept in the layout on the last slide (just hidden) so the header doesn't jump. */}
        <button
          type="button"
          onClick={() => finish("login")}
          className={`h-11 px-2 text-[15px] font-semibold text-muted ${last ? "invisible" : ""}`}
          tabIndex={last ? -1 : 0}
          aria-hidden={last}
        >
          Skip
        </button>
      </div>

      <div
        ref={track}
        className="relative flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map(({ Icon, title, body, Art }, i) => (
          <section
            key={title}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}: ${title}`}
            aria-hidden={i !== index}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
          >
            <div className="flex w-full justify-center [@media(max-height:620px)]:hidden">
              <Art />
            </div>
            <span className="mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-lime-soft text-lime ring-1 ring-lime/25 [@media(max-height:620px)]:mt-0">
              <Icon size={22} aria-hidden />
            </span>
            <h2 className="display mt-4 text-[34px] leading-none">{title}</h2>
            <p className="mt-3 max-w-[19rem] text-[15px] leading-relaxed text-muted">{body}</p>
          </section>
        ))}
      </div>

      <div className="relative px-6">
        <div className="mb-5 flex justify-center gap-2" role="tablist" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className="grid h-6 place-items-center px-0.5"
            >
              <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-lime" : "w-2 bg-line"}`} />
            </button>
          ))}
        </div>

        {last ? (
          <div className="space-y-3">
            <button type="button" onClick={() => finish("signup")} className="btn-primary h-[60px] w-full rounded-2xl text-base">
              Create an account
            </button>
            <button type="button" onClick={() => finish("login")} className="btn-secondary h-[60px] w-full rounded-2xl">
              I already have an account
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => goTo(index + 1)} className="btn-primary h-[60px] w-full rounded-2xl text-base">
            Next
          </button>
        )}
      </div>
    </div>
  );
}
