"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { fmt, tr, useI18n } from "@/lib/i18n";

export default function TeacherWorkspace(props: any) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { classId, className, subjectId, subjectName, roster, date, existingRecords, assessments, resultsByAssessment, unassignedClassId } = props;
  const initial: Record<string,string> = {};
  for (const r of existingRecords||[]) initial[r.student_id]=r.status;
  for (const s of roster||[]) if(!initial[s.id]) initial[s.id]="present";
  const [att, setAtt] = useState<Record<string,string>>(initial);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  function tApiError(e: any, fallback: string) {
    if (!e) return fallback;
    if (e === "Invalid credentials") return t.messages.invalidCreds;
    return (t.messages as any)[e] || e;
  }

  async function saveAttendance() {
    setBusy(true); setMsg(""); setErr("");
    const records = Object.entries(att).map(([student_id,status])=>({student_id,status}));
    const res = await fetch("/api/attendance", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ classId, subjectId, date, records }) });
    const data = await res.json().catch(()=>({}));
    setBusy(false);
    if(!res.ok) setErr(tApiError(data.error, t.messages.failed)); else { setMsg(t.messages.attendanceSaved); router.refresh(); }
  }
  async function tryForbidden() {
    if(!unassignedClassId) return;
    setBusy(true); setMsg(""); setErr("");
    const res = await fetch(`/api/attendance?classId=${unassignedClassId}&subjectId=${subjectId}&date=${date}`);
    const data = await res.json().catch(()=>({}));
    setBusy(false);
    if(!res.ok) setErr(fmt(t.messages.deniedExpected, { status: res.status, error: tApiError(data.error, String(res.status)) })); else setMsg(t.messages.unexpectedAllow);
  }

  async function saveScores(assessmentId: string) {
    setBusy(true); setMsg(""); setErr("");
    const inputs = Array.from(document.querySelectorAll(`[data-as="${assessmentId}"]`)) as HTMLInputElement[];
    const scores = inputs.map(i=>({ student_id: i.dataset.student!, score: i.value===""? null : Number(i.value) }));
    const res = await fetch("/api/grades", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"save_scores", assessmentId, scores }) });
    const data = await res.json().catch(()=>({}));
    setBusy(false);
    if(!res.ok) setErr(tApiError(data.error, t.messages.failed)); else { setMsg(t.messages.draftSaved); router.refresh(); }
  }
  async function publish(assessmentId: string) {
    setBusy(true); setMsg(""); setErr("");
    const res = await fetch("/api/grades", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"publish", assessmentId }) });
    const data = await res.json().catch(()=>({}));
    setBusy(false);
    if(!res.ok) setErr(tApiError(data.error, t.messages.failed)); else { setMsg(t.messages.published); router.refresh(); }
  }
  async function correct(assessmentId: string) {
    const reason = prompt(t.teacher.correctPrompt, t.teacher.correctDefault);
    if (reason===null) return;
    setBusy(true); setMsg(""); setErr("");
    const res = await fetch("/api/grades", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"unpublish", assessmentId, reason }) });
    const data = await res.json().catch(()=>({}));
    setBusy(false);
    if(!res.ok) setErr(tApiError(data.error, t.messages.failed)); else { setMsg(t.messages.corrected); router.refresh(); }
  }

  const statusOptions = [
    { value: "present", label: t.statuses.present },
    { value: "absent", label: t.statuses.absent },
    { value: "late", label: t.statuses.late },
    { value: "excused", label: t.statuses.excused },
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title={t.teacher.attendanceRegister} subtitle={`${tr(t, className)} · ${tr(t, subjectName||"")} · ${t.teacher.session} ${date}`}>
        <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">{t.teacher.attendanceDesc}</p>
        <div className="overflow-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f4ec]"><tr><th className="text-left px-4 py-3">{t.teacher.student}</th><th className="text-left px-4 py-3 w-48">{t.teacher.statusLabel}</th></tr></thead>
            <tbody>{roster.map((s:any)=>(
              <tr key={s.id} className="border-t border-[var(--line)]/70 hover:bg-[#fcfbf8]">
                <td className="px-4 py-3"><div className="font-medium text-[var(--ink)]">{s.first_name} {s.last_name}</div><div className="text-xs text-[var(--muted)]">{s.student_no}</div></td>
                <td className="px-4 py-3"><select className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]" value={att[s.id]} onChange={e=>setAtt({...att,[s.id]:e.target.value})}>
                  {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          <button disabled={busy} onClick={saveAttendance} className="rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0e2f49] disabled:opacity-60 transition-colors">{t.teacher.saveAttendance}</button>
          {unassignedClassId && <button disabled={busy} onClick={tryForbidden} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-100">{t.teacher.testUnauthorized}</button>}
        </div>
      </Card>

      <Card title={t.teacher.gradebook} subtitle={t.teacher.gradebookSub}>
        <div className="space-y-4">
          {assessments.map((a:any)=>{
            const res = resultsByAssessment[a.id]||[];
            const map: Record<string, any> = {}; res.forEach((r:any)=>map[r.student_id]=r.score);
            const published = a.status === 'published';
            return (
              <div key={a.id} className="rounded-xl border border-[var(--line)] bg-[#fcfbf8] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-semibold text-[var(--ink)]">{tr(t, a.title)} <span className="font-normal text-[var(--muted)]">· {tr(t, a.subject_name)}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <span>{t.teacher.maxScore} {a.max_score}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${published?"bg-teal-100 text-teal-800":"bg-amber-100 text-amber-800"}`}>{(t.statuses as any)[a.status] || a.status}</span>
                      {a.published_at && <span>{t.teacher.publishedLabel} {new Date(a.published_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!published ? <button disabled={busy} onClick={()=>publish(a.id)} className="rounded-lg bg-[var(--brand-2)] px-3 py-2 text-sm font-semibold text-white hover:bg-[#184f4b]">{t.teacher.publishResults}</button>
                    : <button disabled={busy} onClick={()=>correct(a.id)} className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[#f7f4ec]">{t.teacher.correctAudited}</button>}
                  </div>
                </div>
                <div className="overflow-auto rounded-lg border border-[var(--line)] bg-white">
                  <table className="w-full text-sm"><tbody>{roster.map((s:any)=>(
                    <tr key={s.id} className="border-t border-[var(--line)]/70 first:border-t-0">
                      <td className="px-3 py-2.5 text-[var(--ink)]">{s.first_name} {s.last_name}</td>
                      <td className="px-3 py-2.5 w-32"><input data-as={a.id} data-student={s.id} defaultValue={map[s.id] ?? ""} type="number" min={0} max={a.max_score} step="0.5" className="w-full rounded-md border border-[var(--line)] px-2.5 py-1.5 text-[var(--ink)]" placeholder="—" /></td>
                    </tr>
                  ))}</tbody></table>
                </div>
                <button disabled={busy} onClick={()=>saveScores(a.id)} className="mt-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[#f7f4ec]">{t.teacher.saveDraft}</button>
              </div>
            );
          })}
          {assessments.length===0 && <div className="text-sm text-[var(--muted)]">{t.teacher.noAssessments}</div>}
        </div>
      </Card>

      {(msg || err) && <div className={`lg:col-span-2 rounded-xl border px-4 py-3 text-sm ${err?"border-red-200 bg-red-50 text-red-800":"border-teal-200 bg-teal-50 text-teal-900"}`}><b className="mr-1">{err?t.teacher.actionBlocked:t.teacher.success}</b>{err || msg}</div>}

      <div className="lg:col-span-2">
        <Card title={t.teacher.aiTitle} subtitle={t.teacher.aiSub}>
          <AIAssistant classId={classId} />
        </Card>
      </div>
    </div>
  );
}

function AIAssistant({ classId }: { classId: string }) {
  const { t, lang } = useI18n();
  const suggestions = t.aiSuggestions;
  const [q, setQ] = useState(suggestions[0]);
  const [ans, setAns] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function ask(question?: string) {
    const qq = question ?? q;
    if (question) setQ(question);
    setBusy(true); setAns(null);
    const res = await fetch("/api/ai", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ question: qq, classId, lang }) });
    const data = await res.json().catch(()=>({})); setBusy(false); setAns({ status: res.status, ...data });
  }
  const blocked = ans && ans.status >= 400;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-[var(--muted)] leading-relaxed">{t.teacher.aiDesc}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="flex-1 rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[var(--ink)]" value={q} onChange={e=>setQ(e.target.value)} />
        <button disabled={busy} onClick={()=>ask()} className="rounded-lg bg-[var(--ink)] px-5 py-2.5 font-semibold text-white hover:bg-[#0f1824] disabled:opacity-60">{busy?t.teacher.asking:t.teacher.ask}</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {suggestions.map(s=> (
          <button key={s} onClick={()=>ask(s)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)] hover:bg-[#f7f4ec] text-left">{s}</button>
        ))}
      </div>
      {ans && (
        <div className={`rounded-xl border p-4 ${blocked?"border-amber-300 bg-amber-50/70":"border-[var(--line)] bg-[#f7f4ec]/60"}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="font-semibold text-[var(--ink)]">{t.teacher.aiResponse}</div>
            <span className="text-xs text-[var(--muted)]">{t.teacher.aiMeta}</span>
          </div>
          <p className="text-[var(--ink)] leading-relaxed">{ans.answer || ans.error}</p>
          {ans.citations?.length>0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">{t.teacher.citations}</div>
              <ul className="space-y-1">{ans.citations.map((c:any,i:number)=><li key={i} className="flex gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-2)] shrink-0" /><span><span className="font-medium text-[var(--ink)]">{c.label}</span>{c.detail? <span className="text-[var(--muted)]"> — {c.detail}</span>:null}</span></li>)}</ul>
            </div>
          )}
          {ans.limitations?.length>0 && <div className="mt-3 text-xs text-[var(--muted)]"><b className="text-[var(--ink)] font-medium">{t.teacher.limitations}</b> {ans.limitations.join(" ")}</div>}
          {ans.abstained && <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">{t.teacher.abstained}</div>}
        </div>
      )}
    </div>
  );
}
