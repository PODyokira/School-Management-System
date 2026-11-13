import { getSessionUser, guardianLinkedStudent } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/Card";
import { getDict, getLangFromCookie, tr, fmt } from "@/lib/i18n-data";

export default async function GuardianPage({ searchParams }: { searchParams: Promise<{ student?: string, probe?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "guardian") redirect("/");
  const cookieStore = await cookies();
  const lang = getLangFromCookie(cookieStore.toString());
  const t = getDict(lang);
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const db = getDb();
  const sp = await searchParams;
  const children = db.prepare(`
    SELECT s.* FROM students s
    JOIN student_guardians sg ON sg.student_id=s.id
    JOIN guardians g ON g.id=sg.guardian_id
    WHERE g.user_id=? AND sg.verified=1
  `).all(user.id) as any[];
  const selectedId = sp.student && children.find(c=>c.id===sp.student) ? sp.student : children[0]?.id;

  let published: any[] = [];
  let attendance: any[] = [];
  if (selectedId) {
    published = db.prepare(`
      SELECT a.title, a.max_score, a.published_at, ar.score, sub.name subject_name, c.name class_name
      FROM assessment_results ar
      JOIN assessments a ON a.id=ar.assessment_id
      JOIN subjects sub ON sub.id=a.subject_id
      JOIN classes c ON c.id=a.class_id
      WHERE ar.student_id=? AND a.status='published'
      ORDER BY a.published_at DESC
    `).all(selectedId) as any[];
    attendance = db.prepare(`
      SELECT s.session_date, ar.status, sub.name subject_name, c.name class_name
      FROM attendance_records ar
      JOIN attendance_sessions s ON s.id=ar.session_id
      JOIN subjects sub ON sub.id=s.subject_id
      JOIN classes c ON c.id=s.class_id
      WHERE ar.student_id=?
      ORDER BY s.session_date DESC LIMIT 20
    `).all(selectedId) as any[];
  }

  const probeId = sp.probe || "s2";
  const probeAllowed = guardianLinkedStudent(user.id, probeId);
  const probeStudent = db.prepare("SELECT student_no FROM students WHERE id=?").get(probeId) as any;

  return (
    <Shell title={t.guardian.title}>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={t.guardian.myChildren}>
          {children.length===0 ? <p className="text-sm text-[var(--muted)]">{t.guardian.noChildren}</p> : (
            <div className="space-y-2">{children.map(c=> (
              <a key={c.id} href={`/guardian?student=${c.id}`} className={`block border rounded-xl p-4 transition-colors ${selectedId===c.id?"border-[var(--brand)] bg-[#f0f5f8] ring-1 ring-[var(--brand)]/15":"border-[var(--line)] hover:bg-[#faf9f6]"}`}>
                <div className="font-medium">{c.first_name} {c.last_name}</div>
                <div className="text-sm text-[var(--muted)]">{c.student_no} · {(t.statuses as any)[c.status] || c.status}</div>
              </a>
            ))}</div>
          )}
          <p className="text-xs text-[var(--muted)] mt-3">{t.guardian.authNote}</p>
        </Card>

        <Card title={t.guardian.accessCheck} tone={probeAllowed?"ok":"warn"}>
          <p className="text-sm">{fmt(t.guardian.attempt, { id: probeStudent?.student_no || probeId })}</p>
          <div className={`mt-2 rounded p-3 text-sm ${probeAllowed?"bg-teal-50 text-teal-900 border border-teal-200":"bg-red-50 text-red-900 border border-red-200"}`}>
            {probeAllowed ? t.guardian.allowed : t.guardian.denied}
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">{t.guardian.enforced}</p>
        </Card>

        <Card title={t.guardian.publishedGrades}>
          {!selectedId ? <p className="text-sm text-[var(--muted)]">{t.guardian.noChild}</p> : published.length===0 ? <p className="text-sm text-[var(--muted)]">{t.guardian.noPublished}</p> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-[var(--muted)]"><th>{t.guardian.assessment}</th><th>{t.guardian.subject}</th><th>{t.guardian.score}</th><th>{t.guardian.publishedAt}</th></tr></thead>
              <tbody>{published.map((p,i)=>(<tr key={i} className="border-t"><td className="py-1">{tr(t, p.title)}</td><td>{tr(t, p.subject_name)}</td><td><b>{p.score ?? "—"}</b> / {p.max_score}</td><td className="text-xs text-[var(--muted)]">{p.published_at?new Date(p.published_at).toLocaleString(locale):""}</td></tr>))}</tbody></table>
          )}
        </Card>

        <Card title={t.guardian.attendance}>
          {!selectedId ? <p className="text-sm text-[var(--muted)]">{t.guardian.noChild}</p> : attendance.length===0 ? <p className="text-sm text-[var(--muted)]">{t.guardian.noAttendance}</p> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-[var(--muted)]"><th>{t.guardian.date}</th><th>{t.guardian.class}</th><th>{t.guardian.subject}</th><th>{t.admin.status}</th></tr></thead>
              <tbody>{attendance.map((a,i)=>(<tr key={i} className="border-t"><td className="py-1">{a.session_date}</td><td>{tr(t, a.class_name)}</td><td>{tr(t, a.subject_name)}</td><td>{(t.statuses as any)[a.status] || a.status}</td></tr>))}</tbody></table>
          )}
        </Card>
      </div>
      <p className="text-xs text-[var(--muted)] mt-4">{t.guardian.pocNote}</p>
    </Shell>
  );
}

