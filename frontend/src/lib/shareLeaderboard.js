import logo from "../assets/logo.svg";
import { rankingValue, rankingLabel } from "./ranking";

// Draws a branded leaderboard picture on a canvas and hands it to the phone's
// share sheet, so it can be dropped straight into a WhatsApp group.
// No extra libraries: everything is painted by hand so it looks the same on
// every phone and always uses the app's fonts.

const W = 1080;
const PAD = 64;
const MAX_ROWS = 16; // beyond podium; the rest become "+N more"

const INK = "#F3F7F1";
const MUTED = "#9FB0A5";
const LIME = "#CCF53C";
const LINE = "#1F2D25";
// Same tones as <Avatar />.
const TONES = [
  ["#16263F", "#8FB4FF"],
  ["#12301F", "#7FE0A6"],
  ["#38181A", "#FF9A9A"],
  ["#291F42", "#C2A9FF"],
  ["#38280C", "#FFC966"],
  ["#10303A", "#7FD3EC"],
];
const MEDAL = { 1: ["#F5B73B", "#2A2108"], 2: ["#B4C0CC", "#1D2429"], 3: ["#D58A4B", "#2A1B10"] };

const DISPLAY = '"Barlow Condensed", Impact, "Arial Narrow", sans-serif';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

function toneFor(key = "") {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
function initialsOf(name = "") {
  const p = String(name).trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
function spaced(ctx, text, x, y, gap) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function avatar(ctx, name, cx, cy, r, ring) {
  const [bg, fg] = toneFor(name);
  if (ring) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#0B130F";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `600 ${Math.round(r * 0.78)}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initialsOf(name), cx, cy + 2);
}
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderLeaderboardImage({ groupName, playerStats, rankingMethod, date = new Date() }) {
  const players = playerStats || [];
  try {
    await Promise.all([
      document.fonts.load(`italic 800 60px "Barlow Condensed"`),
      document.fonts.load(`italic 700 60px "Barlow Condensed"`),
      document.fonts.load(`600 30px Inter`),
      document.fonts.load(`400 30px Inter`),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  const logoImg = await loadImage(logo);

  const rest = players.slice(3, 3 + MAX_ROWS);
  const hidden = Math.max(0, players.length - 3 - rest.length);
  const HEAD = 300;
  const PODIUM_H = 560;
  const ROW_H = 96;
  const rowsH = rest.length * ROW_H + (hidden ? 70 : 0);
  const FOOT = 170;
  const H = HEAD + PODIUM_H + (rest.length ? 40 : 0) + rowsH + FOOT;

  const scale = 1; // 1080 px wide is plenty for WhatsApp and keeps the file small
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // background: near-black with a green floodlight from above
  ctx.fillStyle = "#060A08";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -40, 0, W / 2, -40, 900);
  glow.addColorStop(0, "rgba(46,125,70,0.55)");
  glow.addColorStop(1, "rgba(46,125,70,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 900);
  ctx.fillStyle = LIME;
  ctx.fillRect(0, 0, W, 8);

  // header
  ctx.fillStyle = "#060807";
  roundRect(ctx, PAD, 64, 112, 112, 30);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (logoImg) ctx.drawImage(logoImg, PAD + 8, 72, 96, 96);

  const tx = PAD + 112 + 32;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = LIME;
  ctx.font = `600 24px ${SANS}`;
  spaced(ctx, "LEADERBOARD", tx, 100, 6);
  ctx.fillStyle = INK;
  ctx.font = `italic 800 68px ${DISPLAY}`;
  ctx.fillText(fit(ctx, String(groupName || "Our group").toUpperCase(), W - PAD - tx), tx, 160);
  ctx.fillStyle = MUTED;
  ctx.font = `400 28px ${SANS}`;
  const dateText = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  ctx.fillText(`${dateText}  ·  ranked by ${rankingLabel(rankingMethod)}`, tx, 212);

  // podium: 2nd | 1st | 3rd
  const colW = (W - PAD * 2) / 3;
  const baseY = HEAD + PODIUM_H - 20;
  const specs = [
    { rank: 2, col: 0, step: 130, r: 64 },
    { rank: 1, col: 1, step: 200, r: 82 },
    { rank: 3, col: 2, step: 90, r: 64 },
  ];
  for (const s of specs) {
    const p = players[s.rank - 1];
    if (!p) continue;
    const cx = PAD + colW * s.col + colW / 2;
    const [ring, soft] = MEDAL[s.rank];
    const stepTop = baseY - s.step;

    // step
    ctx.fillStyle = soft;
    roundRect(ctx, cx - colW / 2 + 8, stepTop, colW - 16, s.step + 20, 22);
    ctx.fill();
    ctx.fillStyle = ring;
    ctx.font = `italic 800 ${s.rank === 1 ? 84 : 64}px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(s.rank), cx, stepTop + s.step / 2 + 6);

    // record, value chip, name, avatar (stacked upward from the step)
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = MUTED;
    ctx.font = `400 28px ${SANS}`;
    ctx.fillText(`${p.wins}–${p.losses}`, cx, stepTop - 22);

    const val = String(rankingValue(p, rankingMethod));
    ctx.font = `600 32px ${SANS}`;
    const vw = ctx.measureText(val).width + 36;
    const chipY = stepTop - 22 - 28 - 52;
    ctx.fillStyle = "#16221B";
    roundRect(ctx, cx - vw / 2, chipY, vw, 52, 16);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textBaseline = "middle";
    ctx.fillText(val, cx, chipY + 27);

    ctx.textBaseline = "alphabetic";
    ctx.font = `600 ${s.rank === 1 ? 36 : 32}px ${SANS}`;
    ctx.fillStyle = INK;
    const nameY = chipY - 18;
    ctx.fillText(fit(ctx, p.name, colW - 24), cx, nameY);

    const avY = nameY - 40 - s.r - 8;
    avatar(ctx, p.name, cx, avY, s.r, ring);
    if (s.rank === 1) {
      // crown dot-trophy: a simple gold star above the leader
      ctx.fillStyle = ring;
      ctx.font = `700 44px ${SANS}`;
      ctx.textBaseline = "middle";
      ctx.fillText("★", cx, avY - s.r - 40);
    }
  }

  // rows 4+
  let y = HEAD + PODIUM_H + 40;
  rest.forEach((p, i) => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    const cy = y + ROW_H / 2;
    ctx.fillStyle = MUTED;
    ctx.font = `600 32px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 4), PAD + 24, cy);
    avatar(ctx, p.name, PAD + 100, cy, 30, null);
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = `500 34px ${SANS}`;
    ctx.fillText(fit(ctx, p.name, 430), PAD + 156, cy);
    ctx.textAlign = "right";
    ctx.fillStyle = MUTED;
    ctx.font = `400 28px ${SANS}`;
    ctx.fillText(`${p.wins}–${p.losses}`, W - PAD - 170, cy);
    ctx.fillStyle = INK;
    ctx.font = `600 34px ${SANS}`;
    ctx.fillText(String(rankingValue(p, rankingMethod)), W - PAD, cy);
    y += ROW_H;
  });
  if (hidden) {
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.font = `400 28px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.fillText(`+ ${hidden} more player${hidden === 1 ? "" : "s"}`, W / 2, y + 36);
  }

  // footer
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = LIME;
  ctx.font = `italic 800 40px ${DISPLAY}`;
  ctx.fillText("NOEXCUSES BADMINTON", W / 2, H - 86);
  ctx.fillStyle = MUTED;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText("noexcusesbadminton.com", W / 2, H - 44);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image"))), "image/png")
  );
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Returns "shared" | "downloaded" | "cancelled".
export async function shareLeaderboard(opts) {
  const blob = await renderLeaderboardImage(opts);
  const fileName = `leaderboard-${new Date().toISOString().slice(0, 10)}.png`;
  const title = `${opts.groupName || "Leaderboard"} — leaderboard`;
  const file = new File([blob], fileName, { type: "image/png" });

  // 1) The app's native share plugin (present in builds that include it): most reliable inside the app.
  const plugins = window.Capacitor?.Plugins || {};
  if (plugins.Filesystem?.writeFile && plugins.Share?.share) {
    try {
      const saved = await plugins.Filesystem.writeFile({
        path: fileName,
        data: await blobToBase64(blob),
        directory: "CACHE",
      });
      await plugins.Share.share({ title, files: [saved.uri] });
      return "shared";
    } catch (e) {
      if (/cancel/i.test(String(e?.message || e))) return "cancelled";
      // Fall through to the WebView share sheet below.
    }
  }

  // 2) The browser / WebView share sheet (Android Chrome, Safari, older app builds).
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled";
  }

  // Inside the phone app a "download" goes nowhere, so say it failed instead of
  // claiming the image was saved.
  if (window.Capacitor?.isNativePlatform?.()) throw new Error("Sharing isn't available right now");

  // 3) Plain download as the last resort (desktop browsers).
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
