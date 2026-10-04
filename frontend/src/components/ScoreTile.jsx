// A pastel stat tile, as in the reference's soft accent cards.
const TONES = {
  brand: "bg-brand-soft text-brand",
  win: "bg-win-soft text-win",
  blush: "bg-blush text-[#B03A6B]",
  warn: "bg-warn-soft text-warn",
};

export default function ScoreTile({ label, value, tone = "brand" }) {
  return (
    <div className={`rounded-3xl p-3.5 ${TONES[tone] || TONES.brand}`}>
      <p className="num text-[22px] font-extrabold leading-none tracking-tight">{value}</p>
      <p className="mt-2 text-xs font-semibold opacity-80">{label}</p>
    </div>
  );
}
