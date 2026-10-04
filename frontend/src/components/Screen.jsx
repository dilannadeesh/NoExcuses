// Mobile-first page column. `bottom` reserves room for whatever is pinned to
// the bottom of the screen so it never covers content.
export default function Screen({ children, wide = false, bottom = "none", className = "" }) {
  const pad = bottom === "nav" ? "pb-28" : bottom === "cta" ? "pb-32" : "pb-12";
  return (
    <main className={`mx-auto w-full px-5 pt-2 ${pad} ${wide ? "max-w-3xl" : "max-w-md md:max-w-xl"} ${className}`}>
      {children}
    </main>
  );
}
