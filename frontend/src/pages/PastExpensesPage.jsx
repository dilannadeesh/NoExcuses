import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";
import { formatMoney } from "../lib/money";

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Every expense added to the group, newest first, each showing the viewer's
// own share so they can see exactly what was added to them.
export default function PastExpensesPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([api.getGroup(groupId), api.listExpenses(groupId)])
      .then(([g, list]) => {
        if (!live) return;
        setGroup(g);
        setExpenses(list);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [groupId]);

  const remove = async (id) => {
    setError("");
    try {
      await api.deleteExpense(groupId, id);
      setExpenses((cur) => cur.filter((x) => x.id !== id));
      setConfirmId(null);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!expenses || !group) {
    return (
      <Screen>
        {error ? <ErrorNote>{error}</ErrorNote> : <LoadingBlock rows={4} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <h1 className="px-1 display text-[32px]">Past expenses</h1>
      <p className="mb-5 mt-1 px-1 text-sm text-muted">{group.name}</p>
      <ErrorNote className="mb-3">{error}</ErrorNote>

      {expenses.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">No expenses yet</p>
          <p className="mt-1 text-sm text-muted">Add the first one from the Owe page.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {expenses.map((x) => {
            const iPaid = x.paid_by === user?.id;
            if (x.kind === "settlement") {
              return (
                <li key={x.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">Settled up</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {iPaid ? "You" : x.paid_by_name} paid {x.settled_with_name || "someone"} back · {dayFormat.format(new Date(x.created_at))}
                      </p>
                    </div>
                    <p className="num shrink-0 text-lg font-semibold text-win">{formatMoney(x.amount_cents)}</p>
                  </div>
                  {x.can_delete && (
                    <div className="mt-3 flex justify-end border-t border-line pt-3">
                      <DeleteControl x={x} confirmId={confirmId} setConfirmId={setConfirmId} remove={remove} />
                    </div>
                  )}
                </li>
              );
            }
            return (
              <li key={x.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{x.description}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {iPaid ? "You" : x.paid_by_name} paid · {dayFormat.format(new Date(x.created_at))}
                    </p>
                  </div>
                  <p className="num shrink-0 text-lg font-semibold">{formatMoney(x.amount_cents)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-sm">
                    {x.i_am_in ? (
                      <>
                        <span className="text-muted">Your share </span>
                        <span className={`num font-semibold ${iPaid ? "text-ink" : "text-loss"}`}>
                          {formatMoney(x.my_share_cents)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">Not split with you</span>
                    )}
                    <span className="text-faint"> · {x.split_count} {x.split_count === 1 ? "person" : "people"}</span>
                  </p>
                  {x.can_delete && <DeleteControl x={x} confirmId={confirmId} setConfirmId={setConfirmId} remove={remove} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}

function DeleteControl({ x, confirmId, setConfirmId, remove }) {
  return confirmId === x.id ? (
    <span className="flex shrink-0 items-center gap-2">
      <button type="button" className="btn-danger" onClick={() => remove(x.id)}>
        Delete
      </button>
      <button type="button" className="text-xs font-semibold text-muted" onClick={() => setConfirmId(null)}>
        Keep
      </button>
    </span>
  ) : (
    <button
      type="button"
      aria-label={`Delete ${x.description}`}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint transition hover:text-loss"
      onClick={() => setConfirmId(x.id)}
    >
      <Trash2 size={17} />
    </button>
  );
}
