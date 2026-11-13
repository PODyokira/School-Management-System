import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/Card";
import { getDict, getLangFromCookie, tr } from "@/lib/i18n-data";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  const cookieStore = await cookies();
  const lang = getLangFromCookie(cookieStore.toString());
  const t = getDict(lang);
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const db = getDb();
  const years = db.prepare("SELECT * FROM academic_years").all() as any[];
  const classes = db.prepare("SELECT c.*, ay.name as year_name FROM classes c JOIN academic_years ay ON ay.id=c.academic_year_id").all() as any[];
  const subjects = db.prepare("SELECT * FROM subjects").all() as any[];
  const teachers = db.prepare("SELECT id,name,email FROM users WHERE role='teacher'").all() as any[];
  const assignments = db.prepare(`SELECT ta.*, u.name teacher, c.name class_name, s.name subject_name
    FROM teaching_assignments ta JOIN users u ON u.id=ta.teacher_user_id JOIN classes c ON c.id=ta.class_id JOIN subjects s ON s.id=ta.subject_id`).all() as any[];
  const students = db.prepare(`SELECT s.*, c.name class_name FROM students s
    LEFT JOIN enrollments e ON e.student_id=s.id LEFT JOIN classes c ON c.id=e.class_id ORDER BY s.student_no`).all() as any[];
  const links = db.prepare(`SELECT sg.*, st.first_name, st.last_name, u.name guardian_name
    FROM student_guardians sg JOIN students st ON st.id=sg.student_id JOIN guardians g ON g.id=sg.guardian_id JOIN users u ON u.id=g.user_id`).all() as any[];
  const audits = db.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 8").all() as any[];
  const auditActionLabel = (a: string) => lang === "fr" ? ({
    "seed.completed": "Initialisation terminée",
    "attendance.saved": "Présences enregistrées",
    "grades.draft_saved": "Brouillon des notes enregistré",
    "grades.published": "Notes publiées",
    "grades.corrected_to_draft": "Correction (retour en brouillon)",
  } as Record<string,string>)[a] || a : a;

  return (
    <Shell title={t.admin.title}>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={t.admin.academicSetup}>
          <div className="space-y-3 text-sm">
            <div><div className="font-medium mb-1">{t.admin.academicYear}</div>{years.map(y=> <div key={y.id} className="flex justify-between border border-[var(--line)] rounded-lg p-3 bg-[#fcfbf8]"><span>{tr(t, y.name)} ({(t.statuses as any)[y.status] || y.status})</span><span className="text-[var(--muted)]">{y.start_date} → {y.end_date}</span></div>)}</div>
            <div><div className="font-medium mb-1">{t.admin.classes}</div>{classes.map(c=> <div key={c.id} className="border border-[var(--line)] rounded-lg p-3 bg-[#fcfbf8]">{tr(t, c.name)} <span className="text-[var(--muted)]">· {tr(t, c.year_name)}</span></div>)}</div>
            <div><div className="font-medium mb-1">{t.admin.subjects}</div><div className="flex gap-2 flex-wrap">{subjects.map(s=> <span key={s.id} className="px-2 py-1 bg-[#f0f5f8] text-[var(--brand)] border border-[#d7e2ea] rounded-md">{tr(t, s.name)}</span>)}</div></div>
          </div>
        </Card>
        <Card title={t.admin.staff}>
          <div className="text-sm space-y-3">
            <div><div className="font-medium mb-1">{t.admin.teachers}</div>{teachers.map(teacher=> <div key={teacher.id}>{teacher.name} <span className="text-[var(--muted)]">({teacher.email})</span></div>)}</div>
            <div><div className="font-medium mb-1">{t.admin.assignments}</div>{assignments.map(a=> <div key={a.id} className="border border-[var(--line)] rounded-lg p-3 bg-[#fcfbf8]">{a.teacher} → <b>{tr(t, a.class_name)}</b> / {tr(t, a.subject_name)}</div>)}</div>
            <div><div className="font-medium mb-1">{t.admin.guardianLinks}</div>{links.map(l=> <div key={l.student_id+l.guardian_id} className="border border-[var(--line)] rounded-lg p-3 bg-[#fcfbf8]">{l.guardian_name} ↔ {l.first_name} {l.last_name} <span className="text-[var(--muted)]">({(t.relationships as any)[l.relationship] || l.relationship})</span></div>)}
              <p className="text-xs text-[var(--muted)] mt-1">{t.admin.guardianLinksNote}</p>
            </div>
          </div>
        </Card>
        <Card title={t.admin.studentsEnrollments}>
          <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[var(--muted)]"><th className="py-1">{t.admin.no}</th><th>{t.admin.name}</th><th>{t.admin.class}</th><th>{t.admin.status}</th></tr></thead><tbody>
            {students.map(s=> <tr key={s.id} className="border-t"><td className="py-1">{s.student_no}</td><td>{s.first_name} {s.last_name}</td><td>{s.class_name ? tr(t, s.class_name) : "—"}</td><td>{(t.statuses as any)[s.status] || s.status}</td></tr>)}
          </tbody></table></div>
        </Card>
        <Card title={t.admin.audit}>
          <div className="space-y-2 text-sm">{audits.map(a=> <div key={a.id} className="border border-[var(--line)] rounded-lg p-3 bg-[#fcfbf8]"><div className="font-medium">{auditActionLabel(a.action)} <span className="text-[var(--muted)]">· {a.resource_type}</span></div><div className="text-xs text-[var(--muted)]">{new Date(a.created_at).toLocaleString(locale)}</div>{a.details && <pre className="text-xs bg-[#f7f4ec] p-2 rounded-lg mt-2 overflow-auto border border-[var(--line)]">{a.details}</pre>}</div>)}</div>
        </Card>
      </div>
      <p className="text-xs text-[var(--muted)] mt-4">{t.admin.pocNote}</p>
    </Shell>
  );
}

