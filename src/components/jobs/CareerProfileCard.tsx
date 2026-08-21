import { cardCls, btnGhost, btnPrimary, btnSm } from "../ui";
import type { CareerProfile } from "../../types";
import { defaultCareerProfile } from "../../services/jobs";
import { TagInput } from "./TagInput";

export interface CareerProfileCardProps {
  profile: CareerProfile | null;
  skillSuggestions: string[];
  saving: boolean;
  setProfile: (fn: CareerProfile | ((p: CareerProfile | null) => CareerProfile | null)) => void;
  save: () => void;
  addSuggestedSkill: (s: string) => void;
}

export function CareerProfileCard({
  profile,
  skillSuggestions,
  saving,
  setProfile,
  save,
  addSuggestedSkill,
}: CareerProfileCardProps) {
  return (
    <div className={`${cardCls} mt-5 overflow-hidden`}>
      <div className="border-b border-line/10 p-5">
        <h3 className="text-[14.5px] font-extrabold">🧑‍💼 Career profile</h3>
        <p className="mt-0.5 text-[11.5px] text-fnt">Fill this once — the matcher compares it against every job's required skills. Save anytime; synced to your account when signed in.</p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Headline</span>
          <input className="inp" placeholder="e.g. Senior Frontend Engineer (React + TypeScript)" value={profile?.headline ?? ""}
            onChange={e => setProfile(p => p ? { ...p, headline: e.target.value } : p)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Years of experience</span>
          <input type="number" min={0} max={40} className="inp" value={profile?.years ?? 0}
            onChange={e => setProfile(p => p ? { ...p, years: Number(e.target.value) || 0 } : p)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Location</span>
          <input className="inp" placeholder="e.g. Bengaluru, India" value={profile?.location ?? ""}
            onChange={e => setProfile(p => p ? { ...p, location: e.target.value } : p)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Work authorization</span>
          <input className="inp" placeholder="e.g. India citizen / Any" value={profile?.workAuth ?? ""}
            onChange={e => setProfile(p => p ? { ...p, workAuth: e.target.value } : p)} />
        </label>
        <div className="flex items-end gap-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line/15 bg-wht/10 px-3.5 py-2.5 text-[13px] font-bold">
            <input type="checkbox" checked={profile?.remote ?? true} onChange={e => setProfile(p => p ? { ...p, remote: e.target.checked } : p)} className="h-4 w-4 accent-[#6366f1]" />
            Prefer remote / hybrid
          </label>
          {!profile && (
            <button className={btnGhost + btnSm} onClick={() => setProfile(defaultCareerProfile())}>⚡ Prefill from my skills</button>
          )}
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Target titles</span>
          <TagInput value={profile?.targetTitles ?? []} onChange={v => setProfile(p => p ? { ...p, targetTitles: v } : p)} placeholder="Frontend Engineer, Full Stack Developer…" />
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Skills</span>
          <TagInput value={profile?.skills ?? []} onChange={v => setProfile(p => p ? { ...p, skills: v } : p)} placeholder="react, typescript, node, aws…" />
          {skillSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">💡 Suggestions</span>
              {skillSuggestions.slice(0, 8).map(s => (
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-acc1/30 bg-acc1/10 px-2 py-0.5 text-[11.5px] font-semibold text-acctxt transition-all hover:bg-acc1/20"
                  onClick={() => addSuggestedSkill(s)}
                >
                  {s} <span className="text-[10px] opacity-60">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Summary (optional)</span>
          <textarea className="inp h-36 min-h-[120px] resize-y" placeholder="A few lines about you — used for tailored resumes later." value={profile?.summary ?? ""}
            onChange={e => setProfile(p => p ? { ...p, summary: e.target.value } : p)} />
          <span className="mt-1 block text-[10.5px] text-mut">✏️ Extracted from your resume — edit freely; your edits survive re-uploads.</span>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
        <span className="text-[11.5px] text-fnt">{profile ? `${profile.skills.length} skills · ${profile.targetTitles.length} target titles` : "No profile yet — prefill from your diagnostic or fill it in."}</span>
        <button className={btnPrimary + btnSm} onClick={save} disabled={saving || !profile}>💾 Save profile</button>
      </div>
    </div>
  );
}
