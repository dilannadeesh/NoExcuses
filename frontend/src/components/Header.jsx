export default function Header({ crumb, onHome }) {
  return (
    <header className="border-b border-white/5">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
        <button
          onClick={onHome}
          className="font-display text-3xl leading-none tracking-wide text-chalk hover:text-amber transition-colors"
        >
          SCORE<span className="text-amber">MINE</span>
        </button>
        {crumb && (
          <>
            <span className="text-slate text-lg">/</span>
            <span className="text-slate font-medium">{crumb}</span>
          </>
        )}
      </div>
    </header>
  );
}
