import { Smartphone } from "lucide-react";
import { track } from "../lib/analytics";

export const APP_STORE_URL = "https://apps.apple.com/sg/app/noexcuses-badminton/id6823510583";

// Store buttons for the website. Text-only on purpose: Apple's official
// "Download on the App Store" badge artwork can replace the first one as-is
// (Apple Marketing Tools); hand-drawing Apple's logo isn't allowed. Google
// Play's badge may only be shown once the app is live there, so Android is a
// plain "coming soon" label for now.
export default function AppBadges({ className = "", where = "hero" }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("app_store_click", { where })}
        className="inline-flex h-[52px] items-center gap-2.5 rounded-xl border border-white/30 bg-black px-4 text-white transition hover:border-lime/60"
        aria-label="Download NoExcuses Badminton on the App Store"
      >
        <Smartphone size={22} aria-hidden />
        <span className="flex flex-col text-left leading-none">
          <span className="text-[10px] font-medium tracking-wide">Download on the</span>
          <span className="mt-1 text-[19px] font-semibold tracking-tight">App Store</span>
        </span>
      </a>

      <span
        className="inline-flex h-[52px] cursor-default items-center gap-2.5 rounded-xl border border-dashed border-white/25 bg-black/30 px-4 text-ink/70"
        aria-label="Android app coming soon"
      >
        <Smartphone size={22} aria-hidden />
        <span className="flex flex-col text-left leading-none">
          <span className="text-[10px] font-medium tracking-wide">Android app</span>
          <span className="mt-1 text-[19px] font-semibold tracking-tight">Coming soon</span>
        </span>
      </span>
    </div>
  );
}
