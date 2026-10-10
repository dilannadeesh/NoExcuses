import logo from "../assets/logo.svg";

// The NE shuttlecock mark sits on a black tile, like the app icon.
export default function BrandMark({ size = 40 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-grid shrink-0 place-items-center rounded-[26%] bg-[#060807] ring-1 ring-white/10"
    >
      <img src={logo} alt="" style={{ width: size * 0.9, height: size * 0.9 }} className="object-contain" />
    </span>
  );
}

// "NO EXCUSES" in small spaced caps over a heavy italic "BADMINTON".
export function Wordmark({ className = "" }) {
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span className="text-[9px] font-medium uppercase tracking-[0.42em] text-muted">No Excuses</span>
      <span className="display mt-0.5 text-[24px] font-extrabold text-ink">Badminton</span>
    </span>
  );
}
