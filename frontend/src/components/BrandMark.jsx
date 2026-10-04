import logo from "../assets/logo.svg";

// The logo sits on a black tile, like the reference's wordmark tag -- the
// amber/cream artwork was drawn for dark backgrounds and would wash out on white.
export default function BrandMark({ size = 40 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-grid shrink-0 place-items-center rounded-[28%] bg-ink"
    >
      <img src={logo} alt="" style={{ width: size * 0.74, height: size * 0.74 }} className="object-contain" />
    </span>
  );
}

export function Wordmark({ className = "" }) {
  return (
    <span className={`font-semibold tracking-tight leading-none ${className}`}>
      NoExcuses<span className="font-medium text-muted"> Badminton</span>
    </span>
  );
}
