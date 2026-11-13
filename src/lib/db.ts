import path from "path";
import fs from "fs";
import crypto from "crypto";

type Row = Record<string, any>;
type DB = {
  users: Row[]; academic_years: Row[]; classes: Row[]; subjects: Row[];
  teaching_assignments: Row[]; students: Row[]; guardians: Row[];
  student_guardians: Row[]; enrollments: Row[]; attendance_sessions: Row[];
  attendance_records: Row[]; assessments: Row[]; assessment_results: Row[];
  audit_events: Row[];
};

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "poc.json");

const g = globalThis as any;
function getState(): DB {
  if (!g.__pocState) {
    if (fs.existsSync(dbPath)) {
      try { g.__pocState = JSON.parse(fs.readFileSync(dbPath, "utf8")); } catch { g.__pocState = empty(); }
    } else {
      g.__pocState = empty();
      seed(g.__pocState);
      saveState(g.__pocState);
    }
  }
  return g.__pocState as DB;
}

function empty(): DB {
  return { users:[], academic_years:[], classes:[], subjects:[], teaching_assignments:[], students:[], guardians:[], student_guardians:[], enrollments:[], attendance_sessions:[], attendance_records:[], assessments:[], assessment_results:[], audit_events:[] };
}

function saveState(s: DB) { fs.writeFileSync(dbPath, JSON.stringify(s, null, 2), "utf8"); }
function save() { saveState(getState()); }

export function getDb() {
  const s = getState();
  return {
    prepare(sql: string) {
      return {
        get: (...args: any[]) => runGet(s, sql, args),
        all: (...args: any[]) => runAll(s, sql, args),
        run: (...args: any[]) => runRun(s, sql, args),
      };
    },
    transaction<T>(fn: () => T) {
      return () => { const r = fn(); save(); return r; };
    },
  };
}

function hashPassword(p: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(p, salt, 64).toString("hex");
  return `scrypt:${salt}:${h}`;
}
export function verifyPassword(p: string, stored: string) {
  if (!stored) return false;
  if (stored.startsWith("scrypt:")) {
    const [, salt, h] = stored.split(":");
    const hh = crypto.scryptSync(p, salt, 64).toString("hex");
    try { return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(hh, "hex")); } catch { return false; }
  }
  return false;
}

function seed(db: DB) {
  const now = new Date().toISOString();
  const hp = hashPassword;
  db.users.push(
    {id:"u_admin",email:"admin@demo.school",password_hash:hp("Demo123!"),name:"Amal Admin",role:"admin",created_at:now},
    {id:"u_teacher",email:"teacher@demo.school",password_hash:hp("Demo123!"),name:"Karim Teacher",role:"teacher",created_at:now},
    {id:"u_teacher2",email:"teacher2@demo.school",password_hash:hp("Demo123!"),name:"Sara Teacher",role:"teacher",created_at:now},
    {id:"u_guardian",email:"parent@demo.school",password_hash:hp("Demo123!"),name:"Nadia Parent",role:"guardian",created_at:now},
  );
  db.academic_years.push({id:"ay_2026",name:"2026-2027",start_date:"2026-09-01",end_date:"2027-06-30",status:"active"});
  db.classes.push({id:"c_a",name:"Class A - Grade 6",academic_year_id:"ay_2026"},{id:"c_b",name:"Class B - Grade 6",academic_year_id:"ay_2026"});
  db.subjects.push({id:"sub_math",name:"Mathematics"},{id:"sub_sci",name:"Science"});
  db.teaching_assignments.push(
    {id:"ta1",teacher_user_id:"u_teacher",class_id:"c_a",subject_id:"sub_math"},
    {id:"ta2",teacher_user_id:"u_teacher",class_id:"c_a",subject_id:"sub_sci"},
    {id:"ta3",teacher_user_id:"u_teacher2",class_id:"c_b",subject_id:"sub_math"},
  );
  db.students.push(
    {id:"s1",student_no:"STU-001",first_name:"Youssef",last_name:"El Amrani",status:"active"},
    {id:"s2",student_no:"STU-002",first_name:"Lina",last_name:"Benali",status:"active"},
    {id:"s3",student_no:"STU-003",first_name:"Adam",last_name:"Haddad",status:"active"},
    {id:"s4",student_no:"STU-004",first_name:"Maya",last_name:"Khalil",status:"active"},
    {id:"s5",student_no:"STU-005",first_name:"Omar",last_name:"Ziani",status:"active"},
  );
  db.enrollments.push(
    {id:"e1",student_id:"s1",class_id:"c_a",academic_year_id:"ay_2026",status:"enrolled"},
    {id:"e2",student_id:"s2",class_id:"c_a",academic_year_id:"ay_2026",status:"enrolled"},
    {id:"e3",student_id:"s3",class_id:"c_a",academic_year_id:"ay_2026",status:"enrolled"},
    {id:"e4",student_id:"s4",class_id:"c_a",academic_year_id:"ay_2026",status:"enrolled"},
    {id:"e5",student_id:"s5",class_id:"c_b",academic_year_id:"ay_2026",status:"enrolled"},
  );
  db.guardians.push({id:"g1",user_id:"u_guardian"});
  db.student_guardians.push({student_id:"s1",guardian_id:"g1",relationship:"mother",verified:1});
  db.assessments.push({id:"as1",class_id:"c_a",subject_id:"sub_math",title:"Quiz 1 - Fractions",max_score:20,status:"draft",created_by:"u_teacher",published_at:null,updated_at:now});
  db.assessment_results.push({assessment_id:"as1",student_id:"s1",score:16},{assessment_id:"as1",student_id:"s2",score:14},{assessment_id:"as1",student_id:"s3",score:null},{assessment_id:"as1",student_id:"s4",score:18});
  db.audit_events.push({id:"aud_seed",actor_user_id:"u_admin",action:"seed.completed",resource_type:"system",resource_id:"poc",details:JSON.stringify({note:"Synthetic demo data"}),created_at:now});
}

// Minimal SQL interpreter for the specific queries used by this PoC
function runGet(db: DB, sql: string, args: any[]) { return runAll(db, sql, args)[0]; }
function runRun(db: DB, sql: string, args: any[]) { runAll(db, sql, args); save(); return { changes: 1 }; }
function runAll(db: DB, sql: string, args: any[]): any[] {
  const s = sql.replace(/\s+/g, " ").trim();
  // SELECTs
  if (/^SELECT/i.test(s)) return select(db, s, args);
  // INSERT
  if (/^INSERT INTO audit_events/i.test(s)) { const [id,actor,action,rt,rid,details,at]=args; db.audit_events.unshift({id,actor_user_id:actor,action,resource_type:rt,resource_id:rid,details,created_at:at}); return []; }
  if (/^INSERT INTO attendance_sessions/i.test(s)) { const [id,class_id,subject_id,session_date,created_by,version]=args; db.attendance_sessions.push({id,class_id,subject_id,session_date,created_by,version}); return []; }
  if (/^INSERT INTO attendance_records/i.test(s) && /ON CONFLICT/i.test(s)) {
    const [session_id,student_id,status,marked_by,updated_at]=args;
    const ex = db.attendance_records.find(r=>r.session_id===session_id && r.student_id===student_id);
    if (ex) { ex.status=status; ex.marked_by=marked_by; ex.updated_at=updated_at; } else db.attendance_records.push({session_id,student_id,status,marked_by,updated_at});
    return [];
  }
  if (/^INSERT INTO assessment_results/i.test(s) && /ON CONFLICT/i.test(s)) {
    const [assessment_id,student_id,score]=args;
    const ex = db.assessment_results.find(r=>r.assessment_id===assessment_id && r.student_id===student_id);
    if (ex) ex.score = score; else db.assessment_results.push({assessment_id,student_id,score});
    return [];
  }
  // UPDATEs
  if (/^UPDATE assessments SET status='published'/i.test(s)) { const [published_at,updated_at,id]=args; const a=db.assessments.find(x=>x.id===id); if(a){a.status='published';a.published_at=published_at;a.updated_at=updated_at;} return []; }
  if (/^UPDATE assessments SET status='draft'/i.test(s)) { const [updated_at,id]=args; const a=db.assessments.find(x=>x.id===id); if(a){a.status='draft';a.updated_at=updated_at;} return []; }
  if (/^UPDATE assessments SET updated_at=\?/i.test(s)) { const [updated_at,id]=args; const a=db.assessments.find(x=>x.id===id); if(a) a.updated_at=updated_at; return []; }
  return [];
}

function eq(v:any,a:any){ return String(v)===String(a); }

function select(db: DB, s: string, args: any[]): any[] {
  // users
  if (s.startsWith("SELECT id,email,name,role FROM users WHERE id=?")) return db.users.filter(u=>eq(u.id,args[0])).map(({id,email,name,role})=>({id,email,name,role}));
  if (s.startsWith("SELECT * FROM users WHERE email=?")) return db.users.filter(u=>eq(u.email,args[0]));
  if (s.includes("FROM users WHERE role='teacher'")) return db.users.filter(u=>u.role==='teacher').map(u=>({id:u.id,name:u.name,email:u.email}));
  // academic setup
  if (s.startsWith("SELECT * FROM academic_years")) return [...db.academic_years];
  if (s.includes("FROM classes c JOIN academic_years ay")) return db.classes.map(c=>({...c, year_name: db.academic_years.find(y=>y.id===c.academic_year_id)?.name}));
  if (s.startsWith("SELECT * FROM subjects")) return [...db.subjects];
  if (s.includes("FROM teaching_assignments ta") && s.includes("JOIN classes c") && s.includes("JOIN subjects s")) {
    const rows = db.teaching_assignments.map(ta=>({...ta, teacher: db.users.find(u=>u.id===ta.teacher_user_id)?.name, class_name: db.classes.find(c=>c.id===ta.class_id)?.name, subject_name: db.subjects.find(su=>su.id===ta.subject_id)?.name}));
    if (s.includes("WHERE ta.teacher_user_id=?")) return rows.filter(r=>eq(r.teacher_user_id,args[0]));
    return rows;
  }
  if (s.startsWith("SELECT 1 as ok FROM teaching_assignments WHERE teacher_user_id=? AND class_id=?")) return db.teaching_assignments.some(ta=>eq(ta.teacher_user_id,args[0])&&eq(ta.class_id,args[1]))?[{ok:1}]:[];
  if (s.includes("SELECT id,name FROM classes WHERE id NOT IN")) {
    const assigned = new Set(db.teaching_assignments.filter(ta=>eq(ta.teacher_user_id,args[0])).map(ta=>ta.class_id));
    const c = db.classes.find(c=>!assigned.has(c.id));
    return c?[{id:c.id,name:c.name}]:[];
  }
  // students/enrollments
  if (s.includes("FROM students s") && s.includes("LEFT JOIN enrollments e") && s.includes("LEFT JOIN classes c")) {
    return db.students.map(st=>{ const e=db.enrollments.find(x=>x.student_id===st.id); const c=e?db.classes.find(x=>x.id===e.class_id):null; return {...st,class_name:c?.name}; }).sort((a,b)=>a.student_no.localeCompare(b.student_no));
  }
  if (s.includes("FROM enrollments e JOIN students st") && s.includes("WHERE e.class_id=?")) {
    return db.enrollments.filter(e=>eq(e.class_id,args[0])).map(e=>db.students.find(st=>st.id===e.student_id)).filter(Boolean).sort((a:any,b:any)=>a.last_name.localeCompare(b.last_name));
  }
  if (s.startsWith("SELECT student_id FROM enrollments WHERE class_id=?")) return db.enrollments.filter(e=>eq(e.class_id,args[0])).map(e=>({student_id:e.student_id}));
  if (s.includes("SELECT COUNT(*) as c FROM enrollments WHERE class_id=?")) return [{c: db.enrollments.filter(e=>eq(e.class_id,args[0])).length}];
  // guardian
  if (s.includes("FROM student_guardians sg JOIN students st") && s.includes("JOIN guardians g ON g.id=sg.guardian_id JOIN users u")) {
    return db.student_guardians.map(sg=>{ const st=db.students.find(x=>x.id===sg.student_id); const g=db.guardians.find(x=>x.id===sg.guardian_id); const u=db.users.find(x=>x.id===g?.user_id); return {...sg, first_name:st?.first_name,last_name:st?.last_name,guardian_name:u?.name}; });
  }
  if (s.includes("FROM student_guardians sg") && s.includes("JOIN guardians g ON g.id = sg.guardian_id") && s.includes("WHERE g.user_id = ? AND sg.student_id = ?")) {
    return db.student_guardians.some(sg=>{ const g=db.guardians.find(x=>x.id===sg.guardian_id); return g && eq(g.user_id,args[0]) && eq(sg.student_id,args[1]) && sg.verified==1; })?[{ok:1}]:[];
  }
  if (s.includes("FROM students s") && s.includes("JOIN student_guardians sg") && s.includes("WHERE g.user_id=?")) {
    const g = db.guardians.find(x=>eq(x.user_id,args[0])); if(!g) return [];
    const ids = new Set(db.student_guardians.filter(sg=>sg.guardian_id===g.id && sg.verified==1).map(sg=>sg.student_id));
    return db.students.filter(st=>ids.has(st.id));
  }
  if (s.startsWith("SELECT student_no FROM students WHERE id=?")) { const st=db.students.find(x=>eq(x.id,args[0])); return st?[{student_no:st.student_no}]:[]; }
  // attendance
  if (s.startsWith("SELECT * FROM attendance_sessions WHERE class_id=? AND subject_id=? AND session_date=?")) return db.attendance_sessions.filter(x=>eq(x.class_id,args[0])&&eq(x.subject_id,args[1])&&eq(x.session_date,args[2]));
  if (s.startsWith("SELECT * FROM attendance_records WHERE session_id=?")) return db.attendance_records.filter(x=>eq(x.session_id,args[0]));
  if (s.includes("COUNT(*) as c FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.session_id WHERE s.class_id=? AND ar.status='present'")) {
    const sess = new Set(db.attendance_sessions.filter(x=>eq(x.class_id,args[0])).map(x=>x.id));
    return [{c: db.attendance_records.filter(r=>sess.has(r.session_id) && r.status==='present').length}];
  }
  if (s.includes("COUNT(*) as c FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.session_id WHERE s.class_id=?")) {
    const sess = new Set(db.attendance_sessions.filter(x=>eq(x.class_id,args[0])).map(x=>x.id));
    return [{c: db.attendance_records.filter(r=>sess.has(r.session_id)).length}];
  }
  if (s.includes("COUNT(*) as c FROM attendance_sessions WHERE class_id=?")) return [{c: db.attendance_sessions.filter(x=>eq(x.class_id,args[0])).length}];
  if (s.includes("FROM attendance_records ar") && s.includes("JOIN attendance_sessions s") && s.includes("WHERE ar.student_id=?") && s.includes("ORDER BY s.session_date DESC")) {
    return db.attendance_records.filter(ar=>eq(ar.student_id,args[0])).map(ar=>{ const sess=db.attendance_sessions.find(x=>x.id===ar.session_id); const sub=db.subjects.find(x=>x.id===sess?.subject_id); const c=db.classes.find(x=>x.id===sess?.class_id); return {session_date:sess?.session_date,status:ar.status,subject_name:sub?.name,class_name:c?.name}; }).sort((a,b)=>String(b.session_date).localeCompare(String(a.session_date))).slice(0,20);
  }
  // assessments
  if (s.includes("FROM assessments a") && s.includes("JOIN subjects s")) {
    return db.assessments.filter(a=>!s.includes("WHERE a.class_id=?") || eq(a.class_id,args[0])).map(a=>({...a, subject_name: db.subjects.find(su=>su.id===a.subject_id)?.name})).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  }
  if (s.startsWith("SELECT * FROM assessments WHERE id=")) {
    return db.assessments.filter(a=>eq(a.id,args[0]));
  }
  if (s.includes("FROM assessment_results") && s.includes("WHERE assessment_id=")) return db.assessment_results.filter(r=>eq(r.assessment_id,args[0]));
  if (s.includes("FROM assessment_results ar") && s.includes("JOIN assessments a ON a.id=ar.assessment_id") && s.includes("a.status='published'")) {
    return db.assessment_results.filter(ar=>eq(ar.student_id,args[0])).map(ar=>{ const a=db.assessments.find(x=>x.id===ar.assessment_id && x.status==='published'); if(!a) return null; const sub=db.subjects.find(x=>x.id===a.subject_id); const c=db.classes.find(x=>x.id===a.class_id); return {title:a.title,max_score:a.max_score,published_at:a.published_at,score:ar.score,subject_name:sub?.name,class_name:c?.name}; }).filter(Boolean).sort((a:any,b:any)=>String(b.published_at).localeCompare(String(a.published_at)));
  }
  // audit
  if (s.includes("FROM audit_events ORDER BY created_at DESC LIMIT")) { const n = args[0] || 8; return [...db.audit_events].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,n); }
  if (s.startsWith("SELECT * FROM audit_events")) return [...db.audit_events];
  // generic fallbacks
  if (s.startsWith("SELECT * FROM classes WHERE id=?")) return db.classes.filter(c=>eq(c.id,args[0]));
  if (s.startsWith("SELECT * FROM students")) return [...db.students];
  if (s.startsWith("SELECT * FROM users")) return [...db.users];
  return [];
}

export function audit(actor: string | null, action: string, resourceType: string, resourceId: string | null, details: any) {
  const s = getState();
  s.audit_events.unshift({id:`aud_${Math.random().toString(36).slice(2,10)}`, actor_user_id:actor, action, resource_type:resourceType, resource_id:resourceId, details: details?JSON.stringify(details):null, created_at: new Date().toISOString()});
  save();
}

