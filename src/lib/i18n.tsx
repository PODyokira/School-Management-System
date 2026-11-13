"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dicts, type Dict, type Lang } from "./i18n-data";
export type { Lang, Dict } from "./i18n-data";
export { fmt, tr } from "./i18n-data";

const Ctx = createContext<{lang: Lang; setLang: (l:Lang)=>void; t: Dict} | null>(null);

export function LanguageProvider({ children, initialLang }: { children: React.ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang || "en");
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)lang=(en|fr)/);
    const saved = (m?.[1] as Lang) || (localStorage.getItem("lang") as Lang) || null;
    if (saved === "en" || saved === "fr") setLangState(saved);
  }, []);
  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem("lang", l); document.cookie = `lang=${l}; path=/; max-age=31536000`; } catch {}
  }
  useEffect(() => { document.documentElement.lang = lang; try { document.cookie = `lang=${lang}; path=/; max-age=31536000`; } catch {} }, [lang]);
  const t = useMemo(()=>dicts[lang], [lang]);
  return <Ctx.Provider value={{lang,setLang,t}}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const router = useRouter();
  function change(l: Lang) {
    if (l === lang) return;
    setLang(l);
    try { document.cookie = `lang=${l}; path=/; max-age=31536000`; } catch {}
    router.refresh();
  }
  return (
    <div className={`inline-flex items-center rounded-lg border border-[var(--line)] bg-white p-0.5 text-xs font-medium ${className}`} aria-label="Language">
      <button onClick={()=>change("en")} className={`px-2.5 py-1.5 rounded-md transition-colors ${lang==="en"?"bg-[var(--brand)] text-white":"text-[var(--muted)] hover:text-[var(--ink)]"}`}>EN</button>
      <button onClick={()=>change("fr")} className={`px-2.5 py-1.5 rounded-md transition-colors ${lang==="fr"?"bg-[var(--brand)] text-white":"text-[var(--muted)] hover:text-[var(--ink)]"}`}>FR</button>
    </div>
  );
}

