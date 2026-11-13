import { NextResponse } from "next/server";
import { getSessionUser, teacherAssignedToClass } from "@/lib/auth";
import { getDb } from "@/lib/db";

// PoC AI gateway simulation: permission-filtered, grounded on authorized server-computed facts, cited, abstains, no writes.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(()=>({}));
  const { question, classId, lang } = body as { question?: string; classId?: string; lang?: string };
  const isFr = lang === "fr";
  const q = String(question||"").toLowerCase();
  const db = getDb();

  if (classId) {
    if (user.role === "teacher" && !teacherAssignedToClass(user.id, classId)) {
      return NextResponse.json({
        answer: isFr ? "Je ne peux pas accéder à cette classe car vous n'y êtes pas affecté." : "I cannot access this class because you are not assigned to it.",
        citations: [], abstained: true,
        limitations: [isFr ? "Accès refusé par l'autorisation côté serveur." : "Access denied by server-side authorization."]
      }, { status: 403 });
    }
    if (user.role === "guardian") {
      return NextResponse.json({
        answer: isFr ? "Je ne peux pas répondre à des questions sur l'ensemble d'une classe pour les tuteurs dans ce PoC." : "I cannot answer class-wide questions for guardians in this PoC.",
        citations: [], abstained: true
      }, { status: 403 });
    }
  }

  if (q.includes("other student") || q.includes("outside my scope") || q.includes("another school") || q.includes("hidden") || q.includes("staff note") || q.includes("autre élève") || q.includes("hors de mon périmètre") || q.includes("autre école")) {
    return NextResponse.json({
      answer: isFr
        ? "Je ne peux pas fournir d'informations hors de votre périmètre autorisé. J'utilise uniquement les données auxquelles vous êtes autorisé à accéder et je ne révèle pas l'existence de dossiers restreints."
        : "I can't provide information outside your permitted scope. I only use data you're authorized to access and I won't reveal whether restricted records exist.",
      citations: [], abstained: true,
      limitations: [isFr ? "Garde-fou de permissions et de confidentialité appliqué." : "Permission and privacy guardrail applied."]
    });
  }

  if (q.includes("grading publication") || q.includes("publish rule") || q.includes("publication des notes") || q.includes("règle de publication")) {
    return NextResponse.json({
      answer: isFr
        ? "Les notes sont saisies en brouillon, relues, puis publiées par le personnel autorisé. Seuls les résultats publiés sont visibles par les parents/élèves. Les corrections après publication doivent suivre un chemin audité (motif enregistré) ; l'IA ne peut ni publier ni modifier les dossiers officiels."
        : "Grades are entered as drafts, reviewed, then published by authorized staff. Only published results are visible to parents/students. Corrections after publication must follow an audited path (reason recorded); AI cannot publish or change official records.",
      citations: [
        { label: isFr ? "Politique de l'établissement (configurée PoC)" : "School policy (PoC configured)", detail: isFr ? "Cycle des notes : brouillon → publication → correction auditée" : "Grade lifecycle: draft → publish → audited correction" },
        { label: isFr ? "Spécification §5.3 / §9.5" : "Spec §5.3 / §9.5", detail: isFr ? "Validation humaine, aucune écriture directe, auditabilité" : "Human approval, no direct writes, auditability" }
      ],
      limitations: [isFr ? "La politique affichée est celle de la démo PoC ; la politique réelle doit être configurée." : "Policy shown is the PoC demo policy; real school policy must be configured."],
      abstained: false
    });
  }

  if (q.includes("enrolled") || q.includes("how many students") || q.includes("inscrit") || q.includes("combien d'élèves") || q.includes("combien d’eleves") || q.includes("combien d'eleves")) {
    if (!classId) return NextResponse.json({ answer: isFr ? "Veuillez préciser une classe." : "Please specify a class context.", citations: [], abstained: true });
    const row = db.prepare("SELECT COUNT(*) as c FROM enrollments WHERE class_id=?").get(classId) as any;
    return NextResponse.json({
      answer: isFr ? `Il y a ${row.c} élèves inscrits dans cette classe (liste autorisée).` : `There are ${row.c} enrolled students in this class (authorized roster).`,
      citations: [{ label: isFr ? "Données d'inscription" : "Enrollment records", detail: `class_id=${classId}, ${isFr ? "calculé côté serveur" : "computed server-side"}` }],
      abstained: false
    });
  }

  if (q.includes("attendance") || q.includes("présence") || q.includes("presence")) {
    if (!classId) return NextResponse.json({ answer: isFr ? "Veuillez préciser une classe." : "Please specify a class context.", citations: [], abstained: true });
    const total = db.prepare("SELECT COUNT(*) as c FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.session_id WHERE s.class_id=?").get(classId) as any;
    const present = db.prepare("SELECT COUNT(*) as c FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.session_id WHERE s.class_id=? AND ar.status='present'").get(classId) as any;
    const sessions = db.prepare("SELECT COUNT(*) as c FROM attendance_sessions WHERE class_id=?").get(classId) as any;
    if (sessions.c === 0) {
      return NextResponse.json({
        answer: isFr ? "Aucune séance de présence n'a encore été enregistrée pour cette classe, je ne peux donc pas calculer de résumé." : "No attendance sessions have been recorded yet for this class, so I can't compute a summary.",
        citations: [{ label: isFr ? "Séances de présence" : "Attendance sessions", detail: isFr ? "0 séance trouvée" : "0 sessions found" }],
        abstained: true, limitations: [isFr ? "Preuve insuffisante." : "Insufficient evidence."]
      });
    }
    const rate = total.c ? Math.round((present.c / total.c) * 100) : 0;
    return NextResponse.json({
      answer: isFr
        ? `Présences enregistrées : ${present.c}/${total.c} marquages sont « présent » sur ${sessions.c} séance(s) enregistrée(s) (${rate} %).`
        : `Recorded attendance: ${present.c}/${total.c} marks are 'present' across ${sessions.c} saved session(s) (${rate}%).`,
      citations: [{ label: isFr ? "Résumé des présences (calculé côté serveur)" : "Attendance summary (server-computed)", detail: `class_id=${classId}; ${isFr ? "statuts : présent/absent/retard/excusé" : "statuses include present/absent/late/excused"}` }],
      limitations: [isFr ? "Descriptif uniquement ; définitions selon les statuts configurés. Pas de jugement disciplinaire." : "Descriptive only; definitions follow configured statuses. Not a disciplinary judgment."],
      abstained: false
    });
  }

  return NextResponse.json({
    answer: isFr
      ? "Je n'ai pas suffisamment de preuves autorisées pour répondre à cette question dans ce PoC. Essayez de demander un résumé des présences, le nombre d'inscrits ou la règle de publication des notes."
      : "I don't have enough authorized evidence to answer that in this PoC. Try asking about attendance summary, enrollment count, or grading publication rules.",
    citations: [], abstained: true,
    limitations: [isFr ? "S'abstient en cas de preuve insuffisante ou de question non prise en charge." : "Abstains when evidence is insufficient or question is unsupported."]
  });
}
