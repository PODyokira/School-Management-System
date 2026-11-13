import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb, verifyPassword } from "./db";

const COOKIE = "poc_session";
const SECRET = process.env.POC_SESSION_SECRET || "dev-only-secret-change-for-prod";

export type SessionUser = { id: string; email: string; name: string; role: "admin"|"teacher"|"guardian" };

function sign(value: string) {
  const sig = crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
  return `${value}.${sig}`;
}
function verify(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const value = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; } catch { return null; }
  return value;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const userId = verify(raw);
  if (!userId) return null;
  const db = getDb();
  const row = db.prepare("SELECT id,email,name,role FROM users WHERE id=?").get(userId) as SessionUser | undefined;
  return row || null;
}

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, sign(userId), { httpOnly: true, sameSite: "lax", path: "/", secure: false });
}
export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function verifyLogin(email: string, password: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role } as SessionUser;
}

// Authorization helpers (server-side)
export function assertRole(user: SessionUser | null, roles: SessionUser["role"][]) {
  if (!user || !roles.includes(user.role)) return false;
  return true;
}

export function teacherAssignedToClass(teacherUserId: string, classId: string) {
  const db = getDb();
  const row = db.prepare("SELECT 1 as ok FROM teaching_assignments WHERE teacher_user_id=? AND class_id=? LIMIT 1").get(teacherUserId, classId) as any;
  return !!row;
}

export function guardianLinkedStudent(guardianUserId: string, studentId: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT 1 as ok FROM student_guardians sg
    JOIN guardians g ON g.id = sg.guardian_id
    WHERE g.user_id = ? AND sg.student_id = ? AND sg.verified = 1
  `).get(guardianUserId, studentId) as any;
  return !!row;
}
