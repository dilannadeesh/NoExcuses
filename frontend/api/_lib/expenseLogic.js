// Pure helpers for group expenses. All money is whole cents (integers) so
// nothing ever drifts by a fraction of a cent.

export const MAX_AMOUNT_CENTS = 100_000_000; // 1,000,000.00
export const MAX_DESCRIPTION = 100;

// Splits `totalCents` equally between `userIds`. When it doesn't divide evenly
// the leftover cents go one each to the lowest ids, so the result is the same
// every time and always adds back up to the total exactly.
export function splitEqually(totalCents, userIds) {
  const ids = [...new Set(userIds)].sort((a, b) => a - b);
  const base = Math.floor(totalCents / ids.length);
  const extra = totalCents - base * ids.length;
  return ids.map((userId, i) => ({ userId, shareCents: base + (i < extra ? 1 : 0) }));
}

// Checks the body of "add an expense". `memberIds` is the set of user ids in
// the group; the payer and everyone in the split must be one of them.
export function validateExpense(body, memberIds) {
  const members = new Set(memberIds);
  const amount = body?.amount_cents;
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, error: "Enter an amount greater than zero" };
  if (amount > MAX_AMOUNT_CENTS) return { ok: false, error: "That amount is too large" };

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return { ok: false, error: "Add a short description" };
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, error: `Description must be ${MAX_DESCRIPTION} characters or fewer` };
  }

  const paidBy = body.paid_by;
  if (!Number.isInteger(paidBy) || !members.has(paidBy)) {
    return { ok: false, error: "The person who paid must be a member of this group" };
  }

  const splitWith = body.split_with;
  if (!Array.isArray(splitWith) || splitWith.length === 0) {
    return { ok: false, error: "Choose at least one person to split with" };
  }
  if (!splitWith.every((id) => Number.isInteger(id) && members.has(id))) {
    return { ok: false, error: "Everyone you split with must be a member of this group" };
  }

  return {
    ok: true,
    value: { amountCents: amount, description, paidBy, splits: splitEqually(amount, splitWith) },
  };
}

// `debts` is [{ debtor, creditor, cents }] -- how much each person owes each
// person across every expense (the payer's own share is never a debt).
// Returns what `viewerId` owes / is owed, netted per person:
//   net > 0 -> they owe the viewer, net < 0 -> the viewer owes them.
export function netBalancesFor(viewerId, debts) {
  const net = new Map();
  for (const { debtor, creditor, cents } of debts) {
    if (debtor === creditor) continue;
    if (creditor === viewerId) net.set(debtor, (net.get(debtor) || 0) + cents);
    else if (debtor === viewerId) net.set(creditor, (net.get(creditor) || 0) - cents);
  }
  const people = [...net.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([id, cents]) => ({ id, net_cents: cents }))
    .sort((a, b) => Math.abs(b.net_cents) - Math.abs(a.net_cents) || a.id - b.id);
  let owe = 0;
  let owed = 0;
  for (const p of people) {
    if (p.net_cents < 0) owe += -p.net_cents;
    else owed += p.net_cents;
  }
  return { people, owe_cents: owe, owed_cents: owed };
}
