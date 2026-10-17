import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";
import { formatMoney, parseMoney, splitEqually } from "../lib/money";

// Add an expense: amount, what it was for, who paid, and who shares it equally.
export default function AddExpensePage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState(null);
  const [splitWith, setSplitWith] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([api.getGroup(groupId), api.listMembers(groupId)])
      .then(([g, m]) => {
        if (!live) return;
        setGroup(g);
        setMembers(m);
        setPaidBy(m.some((x) => x.id === user?.id) ? user.id : m[0]?.id ?? null);
        setSplitWith(m.map((x) => x.id)); // everyone shares by default
      })
      .catch((e) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [groupId, user?.id]);

  const cents = parseMoney(amountText);
  const shares = useMemo(() => (cents ? splitEqually(cents, splitWith) : []), [cents, splitWith]);
  const shareOf = (id) => shares.find((s) => s.userId === id)?.shareCents;

  const toggle = (id) =>
    setSplitWith((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!cents || cents < 1) return setError("Enter an amount greater than zero, like 24.50");
    if (!description.trim()) return setError("Add a short description, like “Court booking”");
    if (paidBy == null) return setError("Choose who paid");
    if (splitWith.length === 0) return setError("Choose at least one person to split with");
    setSaving(true);
    try {
      await api.addExpense(groupId, {
        amount_cents: cents,
        description: description.trim(),
        paid_by: paidBy,
        split_with: splitWith,
      });
      navigate(`/groups/${groupId}/owe`, { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <Screen>
        <ErrorNote>{loadError}</ErrorNote>
      </Screen>
    );
  }
  if (!group || paidBy === null) {
    return (
      <Screen>
        <LoadingBlock rows={3} />
      </Screen>
    );
  }

  return (
    <Screen bottom="cta">
      <h1 className="px-1 display text-[32px]">Add expense</h1>
      <p className="mb-5 mt-1 px-1 text-sm text-muted">{group.name}</p>

      <form id="expense-form" onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="expense-amount" className="label">Amount</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input
              id="expense-amount"
              className="input num !pl-7 text-lg"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="expense-desc" className="label">Description</label>
          <input
            id="expense-desc"
            className="input"
            maxLength={100}
            placeholder="Court booking, shuttlecocks, drinks…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <fieldset>
          <legend className="label">Who paid</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = paidBy === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPaidBy(m.id)}
                  className={`flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition active:scale-95 ${
                    on ? "border-lime bg-lime text-onlime" : "border-line bg-surface text-ink"
                  }`}
                >
                  {m.id === user?.id ? "You" : m.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <div className="mb-1.5 flex items-center justify-between">
            <legend className="label !mb-0">Split equally between</legend>
            <button
              type="button"
              className="text-xs font-semibold text-lime"
              onClick={() => setSplitWith(splitWith.length === members.length ? [] : members.map((m) => m.id))}
            >
              {splitWith.length === members.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="space-y-2">
            {members.map((m) => {
              const on = splitWith.includes(m.id);
              const share = shareOf(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(m.id)}
                    className={`card flex w-full items-center gap-3 p-3 text-left transition active:scale-[0.99] ${
                      on ? "ring-1 ring-lime" : "ring-1 ring-transparent"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
                        on ? "bg-lime text-onlime" : "border-2 border-line"
                      }`}
                    >
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                    <Avatar name={m.name} size={32} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {m.id === user?.id ? `${m.name} (you)` : m.name}
                    </span>
                    {on && share !== undefined && (
                      <span className="num text-sm font-semibold text-muted">{formatMoney(share)}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {cents && splitWith.length > 0 && (
            <p className="mt-2 px-1 text-xs text-muted">
              {formatMoney(cents)} split {splitWith.length} {splitWith.length === 1 ? "way" : "ways"}. Anyone who
              paid and is ticked covers their own share.
            </p>
          )}
        </fieldset>

        <ErrorNote>{error}</ErrorNote>
      </form>

      <div className="pinned-bar">
        <div className="mx-auto max-w-md px-5 md:max-w-xl">
          <button type="submit" form="expense-form" className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : "Add expense"}
          </button>
        </div>
      </div>
    </Screen>
  );
}
