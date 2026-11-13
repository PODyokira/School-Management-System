export function Card({ title, children, tone, subtitle }: { title: string; children: React.ReactNode; tone?: "ok"|"warn"; subtitle?: string }) {
  const ring = tone === "warn" ? "border-amber-300/70" : tone === "ok" ? "border-teal-300/70" : "border-[var(--line)]";
  const bar = tone === "warn" ? "bg-amber-500" : tone === "ok" ? "bg-teal-600" : "bg-[var(--brand)]";
  return (
    <section className={`relative overflow-hidden rounded-2xl border ${ring} bg-white/95 p-5 shadow-[0_1px_2px_rgba(24,33,47,0.04),0_8px_24px_rgba(24,33,47,0.04)]`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${bar}`} aria-hidden />
      <div className="pl-2">
        <h2 className="font-display text-lg text-[var(--ink)] leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}
