import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/Card";
import TeacherWorkspace from "./workspace";
import { getDict, getLangFromCookie, tr, fmt } from "@/lib/i18n-data";

export default async function TeacherPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");
  const cookieStore = await cookies();
  const lang = getLangFromCookie(cookieStore.toString());
  const t = getDict(lang);
  const db = getDb();
  const assignments = db.prepare(`SELECT ta.class_id, ta.subject_id, c.name class_name, s.name subject_name
    FROM teaching_assignments ta JOIN classes c ON c.id=ta.class_id JOIN subjects s ON s.id=ta.subject_id
    WHERE ta.teacher_user_id=?`).all(user.id) as any[];
  const classes = [...new Map(assignments.map(a=>[a.class_id, {id:a.class_id,name:a.class_name}])).values()];
  const classId = classes[0]?.id;
  const roster = classId ? db.prepare(`SELECT st.* FROM enrollments e JOIN students st ON st.id=e.student_id WHERE e.class_id=? ORDER BY st.last_name`).all(classId) as any[] : [];
  const assessments = classId ? db.prepare(`SELECT a.*, s.name subject_name FROM assessments a JOIN subjects s ON s.id=a.subject_id WHERE a.class_id=? ORDER BY a.updated_at DESC`).all(classId) as any[] : [];
  const resultsByAssessment: Record<string, any[]> = {};
  for (const a of assessments) {
    resultsByAssessment[a.id] = db.prepare("SELECT * FROM assessment_results WHERE assessment_id=?").all(a.id) as any[];
  }
  const today = new Date().toISOString().slice(0,10);
  const subjectId = assignments.find(a=>a.class_id===classId)?.subject_id;
  const existingSession = (classId && subjectId) ? db.prepare("SELECT * FROM attendance_sessions WHERE class_id=? AND subject_id=? AND session_date=?").get(classId, subjectId, today) as any : null;
  const existingRecords = existingSession ? db.prepare("SELECT * FROM attendance_records WHERE session_id=?").all(existingSession.id) as any[] : [];
  const unassignedClass = db.prepare("SELECT id,name FROM classes WHERE id NOT IN (SELECT class_id FROM teaching_assignments WHERE teacher_user_id=?) LIMIT 1").get(user.id) as any;

  return (
    <Shell title={t.teacher.title}>
      <div className="grid gap-4">
        <Card title={t.teacher.myClasses}>
          <div className="text-sm">{t.teacher.assignments} {assignments.map(a=> <span key={a.class_id+a.subject_id} className="inline-block mr-2 mb-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded">{tr(t, a.class_name)} · {tr(t, a.subject_name)}</span>)}
          {assignments.length===0 && <span className="text-slate-500">{t.teacher.noAssignments}</span>}</div>
          {unassignedClass && <div className="mt-2 text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded p-2">{fmt(t.teacher.securityDemo, { class: tr(t, unassignedClass.name) })}</div>}
        </Card>
        {classId ? (
          <TeacherWorkspace
            userId={user.id}
            classId={classId}
            className={classes[0].name}
            subjectId={subjectId}
            subjectName={assignments.find(a=>a.class_id===classId)?.subject_name}
            roster={roster}
            date={today}
            existingRecords={existingRecords}
            assessments={assessments}
            resultsByAssessment={resultsByAssessment}
            unassignedClassId={unassignedClass?.id}
          />
        ) : <Card title={t.teacher.noClass}>{t.teacher.noClassFound}</Card>}
      </div>
    </Shell>
  );
}

