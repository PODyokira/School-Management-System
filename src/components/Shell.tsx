import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDict, getLangFromCookie, tr } from "@/lib/i18n-data";
import { LangSwitch } from "@/lib/i18n";

export async function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const cookieStore = await cookies();
  const lang = getLangFromCookie(cookieStore.toString());
  const t = getDict(lang);
  const roleLabel = { admin: t.roles.Administration, teacher: t.roles.teacher, guardian: t.roles.guardian }[user.role] || user.role;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--line)]/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand)] text-white font-semibold shadow-sm">É</div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-2)] font-semibold">{t.appTag}</div>
              <div className="font-display text-xl leading-tight text-[var(--ink)]">{title}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <LangSwitch />
            <div className="hidden sm:block text-right">
              <div className="font-medium text-[var(--ink)]">{user.name}</div>
              <div className="text-xs text-[var(--muted)]">{roleLabel} · {user.email}</div>
            </div>
            <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-medium text-[var(--brand)]">{t.roles[user.role as keyof typeof t.roles] || user.role}</span>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[#f8f6f1] transition-colors">{t.signOut}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-6 pb-8 text-xs text-[var(--muted)]">{t.footer}</footer>
    </div>
  );
}

