import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, ChevronRight, Plus, ReceiptText } from "lucide-react";
import { api } from "../api";
import Avatar from "../components/Avatar";
import ConfirmSheet from "../components/ConfirmSheet";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";
import { formatMoney } from "../lib/money";
import { enablePush } from "../lib/push";
import { haptic } from "../lib/native";

// Who I owe and who owes me in this group, with the way in to add an expense
// or look back at the ones already added.
export default function OwePage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null); // the person being settled with
  const [settling, setSettling] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(
    () => api.getBalances(groupId).then(setBalances),
    [groupId]
  );

  useEffect(() => {
    let live = true;
    Promise.all([api.getGroup(groupId), api.getBalances(groupId)])
      .then(([g, b]) => {
        if (!live) return;
        setGroup(g);
        setBalances(b);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [groupId]);

  // This is where money notifications matter, so ask for permission here (phone app only).
  useEffect(() => {
    enablePush();
  }, []);

  const settle = async () => {
    setSettling(true);
    setConfirmError("");
    try {
      await api.settleUp(groupId, confirm.id, -confirm.net_cents);
      haptic("success");
      setNotice(`Settled ${formatMoney(-confirm.net_cents)} with ${confirm.name}`);
      setConfirm(null);
      await reload();
    } catch (e) {
      setConfirmError(e.message);
      reload().catch(() => {}); // the amount may have changed; show the fresh one behind the popup
    } finally {
      setSettling(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <ErrorNote>{error}</ErrorNote>
      </Screen>
    );
  }
  if (!balances || !group) {
    return (
      <Screen>
        <LoadingBlock rows={3} />
      </Screen>
    );
  }

  const owedByMe = balances.people.filter((p) => p.net_cents < 0);
  const owedToMe = balances.people.filter((p) => p.net_cents > 0);

  return (
    <Screen bottom="cta">
      <h1 className="px-1 display text-[32px]">Owe</h1>
      <p className="mb-5 mt-1 px-1 text-sm text-muted">{group.name}</p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="num text-2xl font-semibold leading-none text-loss">{formatMoney(balances.owe_cents)}</p>
          <p className="mt-2 text-xs font-medium text-muted">You owe</p>
        </div>
        <div className="card p-4">
          <p className="num text-2xl font-semibold leading-none text-win">{formatMoney(balances.owed_cents)}</p>
          <p className="mt-2 text-xs font-medium text-muted">You’re owed</p>
        </div>
      </div>

      <Link to={`/groups/${groupId}/owe/past`} className="card mb-6 flex items-center gap-3 p-4 transition active:scale-[0.99]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft text-lime">
          <ReceiptText size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Past expenses</span>
          <span className="block text-sm text-muted">See everything added to this group</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-faint" />
      </Link>

      {balances.people.length === 0 && (
        <div className="card p-6 text-center">
          <p className="font-semibold">All settled up</p>
          <p className="mt-1 text-sm text-muted">Nobody owes anybody in this group right now.</p>
        </div>
      )}

      {notice && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-win-soft px-4 py-3 text-sm font-medium text-win">
          <CheckCircle2 size={18} className="shrink-0" /> {notice}
        </p>
      )}

      <PeopleSection title="You owe" people={owedByMe} tone="loss" verb="You owe" onSettle={(p) => { setNotice(""); setConfirmError(""); setConfirm(p); }} />
      <PeopleSection title="Owed to you" people={owedToMe} tone="win" verb="Owes you" />

      <div className="pinned-bar">
        <div className="mx-auto max-w-md px-5 md:max-w-xl">
          <Link to={`/groups/${groupId}/owe/add`} className="btn-primary w-full">
            <Plus size={19} strokeWidth={2.4} /> Add expense
          </Link>
        </div>
      </div>

      {confirm && (
        <ConfirmSheet
          title={`Settle up with ${confirm.name}?`}
          confirmLabel={`Yes, I paid ${formatMoney(-confirm.net_cents)}`}
          busyLabel="Settling…"
          busy={settling}
          error={confirmError}
          onConfirm={settle}
          onCancel={() => setConfirm(null)}
        >
          This records that you’ve paid {confirm.name} <b className="text-ink">{formatMoney(-confirm.net_cents)}</b>, so you’ll
          no longer owe them anything. They’ll get a notification. Only confirm once you’ve actually paid them.
        </ConfirmSheet>
      )}
    </Screen>
  );
}

function PeopleSection({ title, people, tone, verb, onSettle }) {
  if (people.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="section-title mb-3 px-1">{title}</h2>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-3.5">
            <Avatar name={p.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="text-xs text-muted">{verb}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <p className={`num text-lg font-semibold leading-none ${tone === "loss" ? "text-loss" : "text-win"}`}>
                {formatMoney(Math.abs(p.net_cents))}
              </p>
              {onSettle && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => onSettle(p)}>
                  Settle up
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
