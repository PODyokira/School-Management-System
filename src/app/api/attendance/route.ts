import { NextResponse } from "next/server";
import { getSessionUser, teacherAssignedToClass } from "@/lib/auth";
import { getDb, audit } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const subjectId = searchParams.get("subjectId");
  const date = searchParams.get("date") || new Date().toISOString().slice(0,10);
  const db = getDb();
  if (user.role === "teacher") {
    if (!classId || !teacherAssignedToClass(user.id, classId)) return NextResponse.json({ error: "Forbidden: not assigned to this class" }, { status: 403 });
  } else if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = classId && subjectId ? db.prepare("SELECT * FROM attendance_sessions WHERE class_id=? AND subject_id=? AND session_date=?").get(classId, subjectId, date) as any : null;
  let records: any[] = [];
  if (session) records = db.prepare("SELECT * FROM attendance_records WHERE session_id=?").all(session.id) as any[];
  return NextResponse.json({ session, records, date });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "teacher" && user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(()=>({}));
  const { classId, subjectId, date, records } = body as { classId:string; subjectId:string; date:string; records:{student_id:string; status:string}[] };
  if (!classId || !subjectId || !date || !Array.isArray(records)) return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  if (user.role === "teacher" && !teacherAssignedToClass(user.id, classId)) return NextResponse.json({ error: "Forbidden: not assigned to this class" }, { status: 403 });
  const allowed = new Set(["present","absent","late","excused"]);
  const db = getDb();
  // validate roster
  const roster = db.prepare("SELECT student_id FROM enrollments WHERE class_id=?").all(classId) as any[];
  const rosterSet = new Set(roster.map(r=>r.student_id));
  for (const r of records) {
    if (!rosterSet.has(r.student_id)) return NextResponse.json({ error: "Student not in class roster" }, { status: 422 });
    if (!allowed.has(r.status)) return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }
  const tx = db.transaction(() => {
    let session = db.prepare("SELECT * FROM attendance_sessions WHERE class_id=? AND subject_id=? AND session_date=?").get(classId, subjectId, date) as any;
    if (!session) {
      const id = `att_${Math.random().toString(36).slice(2,10)}`;
      db.prepare("INSERT INTO attendance_sessions(id,class_id,subject_id,session_date,created_by,version) VALUES (?,?,?,?,?,1)").run(id,classId,subjectId,date,user.id);
      session = { id };
    }
    const up = db.prepare(`INSERT INTO attendance_records(session_id,student_id,status,marked_by,updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status, marked_by=excluded.marked_by, updated_at=excluded.updated_at`);
    const now = new Date().toISOString();
    for (const r of records) up.run(session.id, r.student_id, r.status, user.id, now);
    audit(user.id, "attendance.saved", "attendance_session", session.id, { classId, subjectId, date, count: records.length });
    return session.id;
  });
  const sessionId = tx();
  return NextResponse.json({ ok: true, sessionId });
}
