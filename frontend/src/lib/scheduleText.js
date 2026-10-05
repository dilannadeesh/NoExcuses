// Turns a schedule into a message that reads well in WhatsApp / Telegram, and
// builds the share links. Pure functions, so they are tested without a browser.

// Share links carry the whole message in the URL. Browsers and apps cope with
// a few thousand characters, but a big session (many courts) can be longer
// than that, so past this length we send a short note plus the link instead.
export const MAX_LINK_TEXT = 2500;

// rounds: the schedule's rounds. nameOf(id) -> name. timeOf(minute) -> label.
export function buildShareText({ title, subtitle, rounds, nameOf, timeOf, link }) {
  const team = (ids) => ids.map(nameOf).join(" & ");
  const lines = [`🏸 ${title}`];
  if (subtitle) lines.push(subtitle);
  lines.push("");
  for (const r of rounds) {
    lines.push(`Round ${r.index} · ${timeOf(r.startMinute)}`);
    for (const m of r.matches) lines.push(`Court ${m.court}: ${team(m.a)} vs ${team(m.b)}`);
    if (r.sitting.length > 0) lines.push(`Resting: ${r.sitting.map(nameOf).join(", ")}`);
    lines.push("");
  }
  if (link) lines.push(link);
  return lines.join("\n").trim();
}

// The text to put in a share link: the full schedule if it fits, otherwise a
// short pointer to the app (where the full schedule always is).
export function textForLink(args) {
  const full = buildShareText(args);
  if (full.length <= MAX_LINK_TEXT) return { text: full, truncated: false };
  const short = [`🏸 ${args.title}`, args.subtitle, "", "The full schedule is in the app:", args.link].filter((x) => x !== undefined && x !== null);
  return { text: short.join("\n").trim(), truncated: true };
}

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// Telegram wants the link and the message separately; it shows the link as a
// preview under the text.
export const telegramUrl = (link, text) =>
  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
