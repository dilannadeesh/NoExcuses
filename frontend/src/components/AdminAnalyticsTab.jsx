import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshCw, Table2, LineChart as LineIcon, Smartphone, Globe } from "lucide-react";
import { api } from "../api";
import { ErrorNote, LoadingBlock } from "./States";

// Categorical slots validated (CVD + contrast) against the dark surface #0E1612.
const PLATFORMS = [
  { key: "ios_app", label: "iOS app", short: "iOS", color: "#3987e5", Icon: Smartphone },
  { key: "android_app", label: "Android app", short: "Android", color: "#d95926", Icon: Smartphone },
  { key: "web", label: "Website", short: "Web", color: "#199e70", Icon: Globe },
];
const NOT_SET = { key: "not_set", label: "Other / not tagged", short: "Other", color: "#6E8075" };
const RANGES = [7, 28, 90];

const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString());
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const dur = (s) => {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}m ${r}s` : `${r}s`;
};
const shortDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

// ---------------------------------------------------------------------------
// Line chart: one series per platform, crosshair tooltip, end labels, table view.

function LineChart({ data, series, height = 200, label }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showLabels = series.length <= 4 && width >= 420;
  const pad = { t: 12, r: showLabels ? 70 : 12, b: 24, l: 34 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  const niceMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const x = (i) => pad.l + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v) => pad.t + h - (v / niceMax) * h;
  const ticks = niceMax <= 4 ? [...Array(niceMax + 1).keys()] : [0, 1, 2, 3, 4].map((k) => (niceMax / 4) * k);
  const xTicks = data.length <= 8 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - pad.l) / w) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };

  // End labels: nudge apart so they never overlap.
  const ends = series
    .map((s) => ({ ...s, v: data.at(-1)?.[s.key] || 0 }))
    .map((s) => ({ ...s, y: y(s.v) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />
            {s.short}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-soft hover:text-ink"
          aria-pressed={asTable}
        >
          {asTable ? <LineIcon size={14} /> : <Table2 size={14} />}
          {asTable ? "Chart" : "Table"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Day</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">{s.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-1.5 text-muted">{shortDay(d.day)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="num px-3 py-1.5 text-right">{fmt(d[s.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            className="block touch-pan-y"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} stroke="#1F2D25" strokeWidth="1" />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6E8075">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="11" fill="#6E8075">
                {data[i] && shortDay(data[i].day)}
              </text>
            ))}
            {series.map((s) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={data.map((d, i) => `${x(i)},${y(d[s.key] || 0)}`).join(" ")}
              />
            ))}
            {showLabels &&
              ends.map((s) => (
                <text key={s.key} x={pad.l + w + 8} y={s.y + 4} fontSize="11" fill="#9FB0A5">
                  {s.short} {fmt(s.v)}
                </text>
              ))}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="#9FB0A5" strokeOpacity=".4" />
                {series.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key] || 0)} r="4" fill={s.color} stroke="#0E1612" strokeWidth="2" />
                ))}
              </g>
            )}
          </svg>
          {hover != null && (
            <div
              className="pointer-events-none absolute top-1 z-10 min-w-[130px] rounded-xl border border-line bg-raised px-3 py-2 text-xs shadow-card"
              style={x(hover) > width / 2 ? { right: width - x(hover) + 10 } : { left: x(hover) + 10 }}
            >
              <div className="mb-1 font-medium text-ink">{shortDay(data[hover].day)}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-3 text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.short}
                  </span>
                  <span className="num text-ink">{fmt(data[hover][s.key])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, sub, children, right }) {
  return (
    <section className="card mb-4 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <p className="num text-lg font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

function PlatformCard({ p, m, days }) {
  return (
    <div className="card p-4" style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}>
      <div className="mb-3 flex items-center gap-2">
        <p.Icon size={16} className="text-muted" aria-hidden />
        <span className="text-sm font-semibold text-ink">{p.label}</span>
      </div>
      <p className="num text-3xl font-semibold leading-none text-ink">{fmt(m.activeInRange)}</p>
      <p className="mt-1.5 text-xs text-muted">active users · last {days} days</p>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
        <Stat label="Today" value={fmt(m.active1)} />
        <Stat label="7 days" value={fmt(m.active7)} />
        <Stat label="30 days" value={fmt(m.active30)} />
        <Stat label={`New · ${days}d`} value={fmt(m.newInRange)} />
        <Stat label="Came back" value={pct(m.returningInRange, m.activeInRange)} sub="2+ days" />
        <Stat label="Signed up here" value={fmt(m.signups)} />
      </div>
      {p.key !== "web" && (
        <p className="mt-3 text-[11px] text-faint">{fmt(m.pushDevices)} with notifications on</p>
      )}
    </div>
  );
}

function GaSetup({ ga }) {
  return (
    <Section title="Google Analytics" sub="Not connected yet — the numbers above come from the app's own database.">
      {ga.problem && <ErrorNote className="mb-3">{ga.problem}</ErrorNote>}
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>Google Cloud console → create a <span className="text-ink">service account</span> → Keys → Add key → JSON.</li>
        <li>Enable the <span className="text-ink">Google Analytics Data API</span> for that Cloud project.</li>
        <li>GA → Admin → Property access management → add the service account's email as <span className="text-ink">Viewer</span>.</li>
        <li>
          Vercel → Environment Variables: <code className="text-ink">GA_PROPERTY_ID</code> (the numeric id from Admin →
          Property details) and <code className="text-ink">GA_SERVICE_ACCOUNT_JSON</code> (paste the whole key file) → Redeploy.
        </li>
        <li>GA → Admin → Custom definitions → User-scoped dimension <code className="text-ink">platform</code> (if not done already).</li>
      </ol>
      {ga.missing?.length > 0 && <p className="mt-3 text-xs text-faint">Missing: {ga.missing.join(", ")}</p>}
    </Section>
  );
}

function GaSection({ ga, days }) {
  if (!ga) return null;
  if (!ga.configured) return <GaSetup ga={ga} />;
  const cols = [...PLATFORMS, ...(ga.byPlatform?.not_set ? [NOT_SET] : [])];
  const bp = ga.byPlatform || {};
  const rows = [
    ["Active users", (m) => fmt(m.activeUsers)],
    ["New users", (m) => fmt(m.newUsers)],
    ["Sessions", (m) => fmt(m.sessions)],
    ["Engagement rate", (m) => (m.sessions ? `${Math.round(m.engagementRate * 100)}%` : "–")],
    ["Avg. time per user", (m) => dur(m.avgEngagementSecondsPerUser)],
    ["Screen views", (m) => fmt(m.screenPageViews)],
  ];
  const dailySeries = cols.filter((c) => ga.daily?.some((d) => d[c.key] > 0));
  const hasPlatformData = Object.keys(bp).length > 0;

  return (
    <>
      {ga.error && (
        <ErrorNote className="mb-4">
          Google Analytics: {ga.error}
          {ga.hint && <div className="mt-1">{ga.hint}</div>}
        </ErrorNote>
      )}

      {hasPlatformData && (
        <Section title="Google Analytics by platform" sub={`Last ${days} days · from GA4, so it includes people who aren't signed in`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] sm:text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-2 pr-3 text-left font-medium" />
                  {cols.map((c) => (
                    <th key={c.key} className={`px-1.5 py-2 text-right font-medium sm:px-2 ${c.key === "not_set" ? "hidden sm:table-cell" : ""}`}>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                        {c.short}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, f]) => (
                  <tr key={name} className="border-t border-line">
                    <td className="py-2 pr-3 text-muted">{name}</td>
                    {cols.map((c) => (
                      <td key={c.key} className={`num whitespace-nowrap px-1.5 py-2 text-right text-ink sm:px-2 ${c.key === "not_set" ? "hidden sm:table-cell" : ""}`}>{bp[c.key] ? f(bp[c.key]) : "–"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bp.not_set && (
            <p className="mt-2 hidden text-[11px] text-faint sm:block">
              “Other” = visits before the app started labelling iOS separately, or before the platform dimension was registered.
            </p>
          )}
        </Section>
      )}

      {dailySeries.length > 0 && (
        <Section title="Daily active users (GA4)">
          <LineChart data={ga.daily} series={dailySeries} label="Google Analytics daily active users by platform" />
        </Section>
      )}

      {ga.events?.length > 0 && (
        <Section title="Key actions and problems" sub="Event counts by platform">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] sm:text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-2 pr-3 text-left font-medium">Event</th>
                  {PLATFORMS.map((c) => (
                    <th key={c.key} className="px-2 py-2 text-right font-medium">{c.short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ga.events.map((e) => {
                  const bad = /error|slow/.test(e.name);
                  return (
                    <tr key={e.name} className="border-t border-line">
                      <td className={`break-all py-1.5 pr-2 font-mono text-[11px] sm:text-xs ${bad ? "text-loss" : "text-muted"}`}>{e.name}</td>
                      {PLATFORMS.map((c) => (
                        <td key={c.key} className="num px-2 py-1.5 text-right text-ink">{fmt(e[c.key])}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ga.screens?.length > 0 && (
          <Section title="Top screens">
            <ul className="space-y-2">
              {ga.screens.map((s) => (
                <li key={s.path}>
                  <div className="mb-1 flex justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-muted">{s.path}</span>
                    <span className="num text-ink">{fmt(s.total)}</span>
                  </div>
                  <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-soft">
                    {[...PLATFORMS, NOT_SET].map((c) =>
                      s[c.key] ? (
                        <span key={c.key} title={`${c.short}: ${fmt(s[c.key])}`} style={{ width: `${(s[c.key] / ga.screens[0].total) * 100}%`, background: c.color }} />
                      ) : null
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {ga.os?.length > 0 && (
          <Section title="Operating system" sub="All visitors, app and browser">
            <ul className="space-y-2">
              {ga.os.map((o) => (
                <li key={o.os}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">{o.os}</span>
                    <span className="num text-ink">{fmt(o.activeUsers)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                    <span className="block h-full rounded-full bg-muted" style={{ width: `${(o.activeUsers / ga.os[0].activeUsers) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

export default function AdminAnalyticsTab() {
  const [days, setDays] = useState(28);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (d = days) => {
    setLoading(true);
    setError("");
    try {
      setData(await api.adminAnalytics(d));
    } catch (e) {
      setError(`[GET /api/admin/analytics] ${e.status ?? "?"}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="seg flex-1" role="tablist" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={days === r}
              onClick={() => setDays(r)}
              className={`seg-item ${days === r ? "seg-item-active" : ""}`}
            >
              {r} days
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => load(days)}
          disabled={loading}
          aria-label="Refresh"
          className="btn h-10 w-10 border border-line bg-surface p-0 text-muted hover:bg-soft hover:text-ink"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {loading && !data ? (
        <LoadingBlock rows={4} />
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {PLATFORMS.map((p) => (
              <PlatformCard key={p.key} p={p} m={data.platforms[p.key]} days={data.range.days} />
            ))}
          </div>

          <Section
            title="Daily active users"
            sub={`Signed-in people per day, ${shortDay(data.range.from)} – ${shortDay(data.range.to)} (${data.range.timezone})`}
          >
            <LineChart data={data.daily} series={PLATFORMS} label="Daily active signed-in users by platform" />
          </Section>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card p-4"><Stat label={`Games logged · ${data.range.days}d`} value={fmt(data.totals.gamesInRange)} /></div>
            <div className="card p-4"><Stat label={`New groups · ${data.range.days}d`} value={fmt(data.totals.groupsInRange)} /></div>
            <div className="card p-4"><Stat label="Used 2+ platforms" value={fmt(data.multiPlatformUsers)} sub={`in ${data.range.days} days`} /></div>
            <div className="card p-4"><Stat label="Joined users" value={fmt(data.totals.users)} sub={`${fmt(data.totals.games)} games all time`} /></div>
          </div>

          <p className="mb-5 px-1 text-[11px] leading-relaxed text-faint">
            Platform tracking started {data.trackingSince ? shortDay(data.trackingSince) : "with this update"}.
            {data.unknownSignups > 0 && ` ${fmt(data.unknownSignups)} people signed up before that, so their sign-up platform is unknown.`}
            {" "}People count once per platform per day; someone on both the app and the website counts on each.
          </p>

          <GaSection ga={data.ga} days={data.range.days} />
        </div>
      ) : null}
    </div>
  );
}
