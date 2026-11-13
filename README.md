# School Management PoC (Vertical Slice Demo)

**Path:** `C:\Users\podyo\OneDrive\Documents\BOX_Hacker\school-management-poc`

This PoC demonstrates the spec’s recommended vertical slice using **synthetic data**:
**Admin setup → Teacher attendance & grade entry (draft/publish) → Guardian sees only linked child’s published info → permission-aware AI with citations**, with server-side authorization and audit events.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Demo accounts (password: `Demo123!`)
| Role | Email | What to demo |
|---|---|---|
| Admin | `admin@demo.school` | Seeded school year/classes/subjects, teacher assignments, students, verified guardian link, audit events |
| Teacher (Karim) | `teacher@demo.school` | Mark/save attendance for **assigned** Class A, enter draft scores, **publish** results, try “access unassigned class” (expect 403), ask AI (cited/grounded/abstains) |
| Teacher 2 (Sara) | `teacher2@demo.school` | Assigned to Class B only (contrast) |
| Guardian (Nadia) | `parent@demo.school` | Sees **only linked child (Youssef, STU-001)** and only **published** grades; unrelated student probe shows **403/denial**; draft grades not visible |

## Demo workflow (suggested 5–7 min)
1. **Admin** (`/admin`): show configured year/class/subjects, teaching assignments (auth source), guardian–child verified link, enrollments, audit log.
2. **Teacher** (`/teacher`): for Class A/Math save attendance (bulk, validated, uniqueness per session/student, audited). Enter scores as **draft**, then **Publish** (guardians see published only). Use **Correct (audited)** to return to draft with reason. Click **Try access unassigned class** to show server-side 403. Use AI panel: ask for attendance summary/enrollment/rule (answers include citations) and ask an out-of-scope question (abstains/denied) — note AI cannot modify records.
3. **Guardian** (`/guardian`): confirm only Youssef is visible, published results appear after teacher publishes, attendance visible; denial example shows no access to non-linked student.

## What this PoC proves (aligned to spec)
- RBAC + relationship checks enforced **server-side** (deny by default): teacher assigned-class only, guardian linked-child only.
- Attendance save with roster/status validation, session uniqueness, transactional upsert, audit event.
- Grade lifecycle: draft → publish → audited correction path; guardians see **published** only.
- Permission-aware AI demo: grounded on authorized server-computed data, returns citations/limitations, abstains on insufficient/out-of-scope, **no direct writes**.
- Synthetic seed data auto-created in `data/poc.db` (SQLite) on first run.

## Not production-ready (by design for PoC)
- Seeded demo auth/basic checks (MVP needs secure auth, invitations/reset, MFA for privileged users, full test suite, etc.).
- Simplified AI (rule/grounded demo, no external LLM dependency) to guarantee safe, cited behavior offline.
- No full import/finance/notifications/reporting/ops hardening — see full cahier des charges for MVP scope.
