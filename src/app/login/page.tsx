"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LangSwitch, useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const demos = [
    { role: t.roles.admin, label: t.demo.adminName, email: "admin@demo.school", password: "Demo123!", note: t.demo.adminNote },
    { role: t.roles.teacher, label: t.demo.teacherAName, email: "teacher@demo.school", password: "Demo123!", note: t.demo.teacherANote },
    { role: t.roles.teacher, label: t.demo.teacherBName, email: "teacher2@demo.school", password: "Demo123!", note: t.demo.teacherBNote },
    { role: t.roles.guardian, label: t.demo.guardianName, email: "parent@demo.school", password: "Demo123!", note: t.demo.guardianNote },
  ];
  const [email, setEmail] = useState("admin@demo.school");
  const [password, setPassword] = useState("Demo123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) { setError(data.error === "Invalid credentials" ? t.messages.invalidCreds : (t.messages as any)[data.error] || data.error || t.messages.failed); return; }
      router.push("/");
      router.refresh();
    } catch {
      setLoading(false);
      setError(t.messages.failed);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0f2438] text-white p-12">
        <div className="absolute inset-0 opacity-30" style={{backgroundImage:"radial-gradient(circle at 20% 20%, #1f5f5b 0, transparent 35%), radial-gradient(circle at 80% 0%, #c89b3c55 0, transparent 30%), linear-gradient(135deg, #0f2438 0%, #123a5a 55%, #102a2f 100%)"}} />
        <div className="absolute inset-0" style={{backgroundImage:"linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize:"48px 48px", maskImage:"linear-gradient(to bottom, black, transparent)"}} />
        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm tracking-wide">
              <span className="h-2 w-2 rounded-full bg-[#c89b3c]" /> {t.loginProof}
            </div>
            <LangSwitch className="bg-white/10 border-white/20 [&_button]:text-white [&_button.bg-\[var\(--brand\)\]]:bg-white [&_button.bg-\[var\(--brand\)\]]:text-[var(--brand)]" />
          </div>
          <h1 className="font-display mt-8 text-5xl leading-[1.05] tracking-tight">{t.loginHeroTitle}</h1>
          <p className="mt-5 max-w-xl text-lg text-slate-200/90 leading-relaxed">{t.loginHeroBody}</p>
        </div>
        <div className="relative grid grid-cols-2 gap-3 max-w-xl text-sm">
          {t.features.map(([title, desc]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="font-medium text-white">{title}</div>
              <div className="mt-1 text-slate-300 leading-snug">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--brand-2)] font-semibold">{t.appTag}</div>
              <h1 className="font-display text-3xl mt-2 text-[var(--ink)]">{t.loginMobileTitle}</h1>
            </div>
            <LangSwitch />
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white/95 p-7 shadow-[0_1px_2px_rgba(24,33,47,0.04),0_20px_50px_rgba(24,33,47,0.08)]">
            <h2 className="font-display text-2xl text-[var(--ink)]">{t.signIn}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.chooseRole}</p>

            <div className="mt-5 space-y-2">
              {demos.map(d => {
                const active = email === d.email;
                return (
                  <button key={d.email} type="button" onClick={()=>{setEmail(d.email);setPassword(d.password);}}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${active?"border-[var(--brand)] bg-[#f0f5f8] ring-1 ring-[var(--brand)]/20":"border-[var(--line)] hover:border-[#b9c3d0] hover:bg-[#faf9f6]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-[var(--ink)]">{d.label} <span className="ml-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand-2)]">{d.role}</span></div>
                        <div className="text-sm text-[var(--muted)] mt-0.5">{d.note}</div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border ${active?"border-[var(--brand)] bg-[var(--brand)]":"border-[#c9ced6]"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">{t.email}</label>
                <input className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[var(--ink)] placeholder:text-[#97a0ad]" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink)]">{t.password}</label>
                <input type="password" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[var(--ink)]" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</div>}
              <button disabled={loading} className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-[#0e2f49] disabled:opacity-60 transition-colors">{loading?t.signingIn:t.continue}</button>
            </form>
            <p className="mt-4 text-xs text-[var(--muted)] leading-relaxed">{t.demoCredentials} <code className="rounded bg-[#f3efe6] px-1.5 py-0.5 text-[var(--ink)]">Demo123!</code> {t.demoCredentialsNote}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
