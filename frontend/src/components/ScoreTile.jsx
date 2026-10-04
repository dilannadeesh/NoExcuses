// A plain stat tile: the number leads, the label sits quietly underneath.
export default function ScoreTile({ label, value }) {
  return (
    <div className="card p-3.5">
      <p className="num text-xl font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
