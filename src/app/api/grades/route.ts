import { NextResponse } from "next/server";
import { getSessionUser, teacherAssignedToClass } from "@/lib/auth";
import { getDb, audit } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(()=>({}));
  const { action } = body;
  const db = getDb();
  if (action === "save_scores") {
    const { assessmentId, scores } = body as { assessmentId:string; scores:{student_id:string; score:number|null}[] };
    const a = db.prepare("SELECT * FROM assessments WHERE id=?").get(assessmentId) as any;
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "teacher" && !teacherAssignedToClass(user.id, a.class_id)) return NextResponse.json({ error: "Forbidden: not assigned to this class" }, { status: 403 });
    if (user.role !== "teacher" && user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const roster = new Set((db.prepare("SELECT student_id FROM enrollments WHERE class_id=?").all(a.class_id) as any[]).map(r=>r.student_id));
    const up = db.prepare(`INSERT INTO assessment_results(assessment_id,student_id,score) VALUES (?,?,?)
      ON CONFLICT(assessment_id,student_id) DO UPDATE SET score=excluded.score`);
    const tx = db.transaction(()=>{
      for (const s of scores||[]) {
        if (!roster.has(s.student_id)) throw new Error("Student not in class");
        if (s.score != null && (s.score < 0 || s.score > a.max_score)) throw new Error("Score out of range");
        up.run(assessmentId, s.student_id, s.score);
      }
      db.prepare("UPDATE assessments SET updated_at=? WHERE id=?").run(new Date().toISOString(), assessmentId);
      audit(user.id, "grades.draft_saved", "assessment", assessmentId, { count: (scores||[]).length });
    });
    try { tx(); } catch(e:any){ return NextResponse.json({ error: e.message||"Invalid" }, { status: 422 }); }
    return NextResponse.json({ ok: true });
  }
  if (action === "publish") {
    const { assessmentId } = body as { assessmentId:string };
    const a = db.prepare("SELECT * FROM assessments WHERE id=?").get(assessmentId) as any;
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // publish permission: admin or assigned teacher (PoC simplification; MVP separates permissions)
    if (user.role === "teacher" && !teacherAssignedToClass(user.id, a.class_id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (user.role !== "teacher" && user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const now = new Date().toISOString();
    db.prepare("UPDATE assessments SET status='published', published_at=?, updated_at=? WHERE id=?").run(now, now, assessmentId);
    audit(user.id, "grades.published", "assessment", assessmentId, { previous: a.status });
    return NextResponse.json({ ok: true });
  }
  if (action === "unpublish") {
    const { assessmentId, reason } = body as { assessmentId:string; reason?:string };
    const a = db.prepare("SELECT * FROM assessments WHERE id=?").get(assessmentId) as any;
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "admin" && !(user.role === "teacher" && teacherAssignedToClass(user.id, a.class_id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    db.prepare("UPDATE assessments SET status='draft', updated_at=? WHERE id=?").run(new Date().toISOString(), assessmentId);
    audit(user.id, "grades.corrected_to_draft", "assessment", assessmentId, { reason: reason||"correction (audited path)" });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
