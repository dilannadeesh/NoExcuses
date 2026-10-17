// Money is whole cents everywhere; these are the only places it becomes text.

export function formatMoney(cents) {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}$${whole}.${frac}`;
}

// "12", "12.5", "12.50", "1,200.5" -> cents. Anything else -> null.
export function parseMoney(text) {
  const t = String(text ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

// Same rule as the server (api/_lib/expenseLogic.js) so the preview matches
// what gets saved: leftover cents go one each to the lowest ids.
export function splitEqually(totalCents, userIds) {
  const ids = [...new Set(userIds)].sort((a, b) => a - b);
  if (ids.length === 0) return [];
  const base = Math.floor(totalCents / ids.length);
  const extra = totalCents - base * ids.length;
  return ids.map((userId, i) => ({ userId, shareCents: base + (i < extra ? 1 : 0) }));
}
