import { useState, type FormEvent } from "react";
import { btnGhost, btnPrimary, btnSm } from "../ui";
import { MAX_PIPELINE_RESUME, PROFILE_FACT_KEYS, type PipelineProfile, type VerifiedFact } from "../../services/applyPipeline";

const LABELS: Record<string, string> = {
  name: "Full name", firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone",
  skills: "Verified skills (comma separated)", role: "Current role", locations: "Preferred locations (comma separated)",
  location: "Current location", yearsExperience: "Total years of experience", noticePeriod: "Notice period / availability",
  currentSalary: "Current salary", expectedSalary: "Expected salary", salaryCurrency: "Salary currency (ISO code)",
  workAuthorization: "Legally authorized to work in this country", requiresSponsorship: "Requires sponsorship in this country",
  relocation: "Willing to relocate", linkedin: "LinkedIn URL", portfolio: "Portfolio URL",
};
const BOOLEAN_KEYS = ["workAuthorization", "requiresSponsorship", "relocation"];
const NUMBER_KEYS = ["yearsExperience", "currentSalary", "expectedSalary"];
const EXPIRING_KEYS = ["noticePeriod", "currentSalary", "expectedSalary", "salaryCurrency", "workAuthorization", "requiresSponsorship"];
const COUNTRY_KEYS = ["currentSalary", "expectedSalary", "salaryCurrency", "workAuthorization", "requiresSponsorship"];
const display = (value: VerifiedFact["value"] | undefined) => value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);
const expiry = (value: string | undefined) => value ? value.slice(0, 10) : "";

export function PipelineProfileForm({ profile, busy, canEdit, onConfirm, onImport }: {
  profile: PipelineProfile | null; busy: boolean; canEdit: boolean;
  onConfirm: (input: { facts: Record<string, VerifiedFact>; resumeText: string; resumeApproved: boolean }) => Promise<void>;
  onImport: () => Promise<{ values: Record<string, VerifiedFact["value"]>; resumeText: string } | null>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(profile?.facts ?? {}).map(([key, fact]) => [key, display(fact.value)])));
  const [countries, setCountries] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(profile?.facts ?? {}).map(([key, fact]) => [key, fact.scope?.country ?? ""])));
  const [expires, setExpires] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(profile?.facts ?? {}).map(([key, fact]) => [key, expiry(fact.validUntil)])));
  const [resumeText, setResumeText] = useState(profile?.resumeText ?? "");
  const [resumeApproved, setResumeApproved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillYears, setSkillYears] = useState("");
  const [portalApprovals, setPortalApprovals] = useState<Record<string, { scope: string; account: string; expiry: string; approved: boolean }>>(() => Object.fromEntries(["naukri", "instahyre"].map(portal => [portal, {
    scope: profile?.facts[`portalProfileApproved:${portal}`]?.scope?.portal ?? `${portal}:www.${portal}.com/candidate`,
    account: display(profile?.facts[`portalAccountIdentity:${portal}`]?.value), expiry: expiry(profile?.facts[`portalProfileApproved:${portal}`]?.validUntil), approved: false,
  }])));
  const disabled = busy || !canEdit;
  const changed = () => { setConfirmed(false); setResumeApproved(false); setPortalApprovals(old => Object.fromEntries(Object.entries(old).map(([key, row]) => [key, { ...row, approved: false }]))); setError(null); };
  const importDraft = async () => {
    const draft = await onImport();
    if (!draft) return;
    setValues(Object.fromEntries(Object.entries(draft.values).filter(([key]) => PROFILE_FACT_KEYS.includes(key as typeof PROFILE_FACT_KEYS[number])).map(([key, value]) => [key, display(value)])));
    setCountries({}); setExpires({}); setResumeText(draft.resumeText); changed();
  };
  const addSkillYears = () => {
    const name = skillName.trim().toLowerCase();
    if (!/^[a-z0-9+#. /-]{1,80}$/.test(name) || !skillYears.trim() || !Number.isFinite(Number(skillYears)) || Number(skillYears) < 0 || Number(skillYears) > 100) {
      setError("Enter an exact skill and verified years between 0 and 100."); return;
    }
    setValues(old => ({ ...old, [`skillYears:${name}`]: skillYears })); setSkillName(""); setSkillYears(""); changed();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !confirmed) return;
    const facts: Record<string, VerifiedFact> = {};
    const confirmedAt = new Date().toISOString();
    const regularValues = Object.entries(values).filter(([key]) => !key.startsWith("portalProfileApproved:") && !key.startsWith("portalAccountIdentity:") && !key.startsWith("portalResumeText:"));
    for (const [key, raw] of regularValues) {
      if (!raw.trim()) continue;
      let value: VerifiedFact["value"] = raw.trim();
      if (["skills", "locations"].includes(key)) value = [...new Set(raw.split(",").map(s => s.trim()).filter(Boolean))];
      else if (BOOLEAN_KEYS.includes(key)) value = raw === "true";
      else if (NUMBER_KEYS.includes(key) || key.startsWith("skillYears:")) {
        value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || ((key === "yearsExperience" || key.startsWith("skillYears:")) && value > 100)) { setError("Use nonnegative numeric salary and experience values."); return; }
      }
      if (key === "salaryCurrency") value = raw.trim().toUpperCase();
      facts[key] = { value, source: "user", confirmedAt,
        ...(COUNTRY_KEYS.includes(key) && countries[key]?.trim() ? { scope: { country: countries[key].trim().toUpperCase() } } : profile?.facts[key]?.scope && !COUNTRY_KEYS.includes(key) ? { scope: profile.facts[key].scope } : {}),
        ...(expires[key] ? { validUntil: `${expires[key]}T23:59:59.000Z` } : {}) };
    }
    for (const [portal, row] of Object.entries(portalApprovals)) {
      if (!row.approved) continue;
      if (!row.account.trim() || !row.expiry || !resumeApproved) { setError("Confirm the exact portal account, expiry and approved resume before enabling in-place applications."); return; }
      const metadata = { source: "user" as const, confirmedAt, scope: { portal: row.scope.trim() }, validUntil: `${row.expiry}T23:59:59.000Z` };
      facts[`portalProfileApproved:${portal}`] = { ...metadata, value: true };
      facts[`portalAccountIdentity:${portal}`] = { ...metadata, value: row.account.trim() };
      facts[`portalResumeText:${portal}`] = { ...metadata, value: resumeText };
    }
    setError(null);
    await onConfirm({ facts, resumeText, resumeApproved });
  };
  return <section aria-label="Verified application profile" className="rounded-xl border border-line/10 bg-deep/30 p-4">
    <h4 className="text-[14px] font-bold">Your verified application profile</h4>
    <p className="mt-1 text-[12px] text-fnt">Drafts and resume extraction are suggestions, not facts. Check each value yourself. Blank fields stay unknown. Changing this profile invalidates previous saved answers and pending approvals.</p>
    <p className="mt-1 text-[12px] text-mut">{profile ? `Saved revision ${profile.revision} · Resume ${profile.resumeApproved ? "approved" : "not approved"}` : "No confirmed pipeline profile yet."}</p>
    <button type="button" className={btnGhost + btnSm + " mt-3"} disabled={disabled} onClick={() => void importDraft()}>Import my saved profile draft</button>
    <form onSubmit={event => void submit(event)} className="mt-3 space-y-3">
      <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
        {PROFILE_FACT_KEYS.map(key => <div key={key} className="space-y-1">
          <label className="block text-[12px] text-fnt">{LABELS[key]}
            {BOOLEAN_KEYS.includes(key) ? <select className="inp mt-1 w-full" aria-label={LABELS[key]} value={values[key] ?? ""} onChange={event => { setValues(old => ({ ...old, [key]: event.target.value })); changed(); }}>
              <option value="">Unknown / not confirmed</option><option value="true">Yes</option><option value="false">No</option>
            </select> : <input className="inp mt-1 w-full" aria-label={LABELS[key]} value={values[key] ?? ""} maxLength={key === "skills" ? 10000 : 500}
              type={key === "email" ? "email" : NUMBER_KEYS.includes(key) ? "number" : "text"} min={NUMBER_KEYS.includes(key) ? 0 : undefined} step="any"
              onChange={event => { setValues(old => ({ ...old, [key]: event.target.value })); changed(); }} />}
          </label>
          {COUNTRY_KEYS.includes(key) && <label className="block text-[11px] text-mut">Country scope (ISO code)
            <input className="inp mt-1 w-full" aria-label={`${LABELS[key]} country scope`} maxLength={2} placeholder="IN / US / GB" value={countries[key] ?? ""} onChange={event => { setCountries(old => ({ ...old, [key]: event.target.value })); changed(); }} />
          </label>}
          {EXPIRING_KEYS.includes(key) && <label className="block text-[11px] text-mut">Valid until (UTC)
            <input className="inp mt-1 w-full" type="date" aria-label={`${LABELS[key]} valid until`} value={expires[key] ?? ""} onChange={event => { setExpires(old => ({ ...old, [key]: event.target.value })); changed(); }} />
          </label>}
        </div>)}
      </fieldset>
      <fieldset disabled={disabled} className="rounded-lg border border-line/10 p-3">
        <legend className="text-[12px] font-bold">Skill-specific experience</legend>
        <p className="text-[11px] text-mut">Total experience never answers a question about a specific skill.</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[12px]">Exact skill<input className="inp mt-1 block" aria-label="Exact skill" value={skillName} onChange={event => setSkillName(event.target.value)} maxLength={80} /></label>
          <label className="text-[12px]">Verified years<input className="inp mt-1 block w-28" type="number" min="0" max="100" step="any" aria-label="Verified skill years" value={skillYears} onChange={event => setSkillYears(event.target.value)} /></label>
          <button type="button" className={btnGhost + btnSm} onClick={addSkillYears}>Add verified skill years</button>
        </div>
        {Object.entries(values).filter(([key]) => key.startsWith("skillYears:")).map(([key, value]) => <div className="mt-2 flex items-center gap-2 text-[12px]" key={key}>
          <span>{key.slice(11)} · {value} years</span><button type="button" className={btnGhost + btnSm} onClick={() => { setValues(old => { const next = { ...old }; delete next[key]; return next; }); changed(); }}>Remove {key.slice(11)} years</button>
        </div>)}
      </fieldset>
      <label className="block text-[12px] text-fnt">Exact resume text
        <textarea className="inp mt-1 min-h-40 w-full" aria-label="Exact resume text" disabled={disabled} value={resumeText} onChange={event => { setResumeText(event.target.value); changed(); }} />
      </label>
      <p className={`text-[11px] ${resumeText.length > MAX_PIPELINE_RESUME ? "text-red-400" : "text-mut"}`}>{resumeText.length.toLocaleString()} / 12,000 characters. Excess text is not truncated; shorten it yourself before approving the exact version.</p>
      <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" disabled={disabled || !resumeText.trim() || resumeText.length > MAX_PIPELINE_RESUME} checked={resumeApproved} onChange={event => setResumeApproved(event.target.checked)} />I approve this exact resume for applications. No AI rewriting is authorized.</label>
      <fieldset disabled={disabled} className="space-y-3 rounded-lg border border-line/10 p-3">
        <legend className="text-[12px] font-bold">Optional in-place portal profile approval</legend>
        <p className="text-[11px] text-mut">Some Naukri / Instahyre applications send the profile and resume already saved on that portal. A login badge is not approval of that profile. Update the real portal yourself, then confirm its exact account and resume here. Unknown portals and fresh legal/demographic questions still require human review.</p>
        {Object.entries(portalApprovals).map(([portal, row]) => <div key={portal} className="space-y-2 rounded-lg border border-line/10 p-3">
          <h5 className="text-[12px] font-bold">{portal === "naukri" ? "Naukri" : "Instahyre"}</h5>
          <label className="block text-[11px]">Exact portal identity<select aria-label={`${portal} approval portal`} className="inp mt-1 w-full" value={row.scope} onChange={event => { setPortalApprovals(old => ({ ...old, [portal]: { ...row, scope: event.target.value, approved: false } })); setConfirmed(false); }}>
            <option value={`${portal}:www.${portal}.com/candidate`}>{portal}:www.{portal}.com/candidate</option><option value={`${portal}:${portal}.com/candidate`}>{portal}:{portal}.com/candidate</option>
          </select></label>
          <label className="block text-[11px]">Actual account identity on this portal<input className="inp mt-1 w-full" aria-label={`${portal} approved account identity`} maxLength={500} value={row.account} onChange={event => { setPortalApprovals(old => ({ ...old, [portal]: { ...row, account: event.target.value, approved: false } })); setConfirmed(false); }} /></label>
          <label className="block text-[11px]">Approval valid until (UTC, within 30 days)<input type="date" className="inp mt-1 w-full" aria-label={`${portal} approval expiry`} value={row.expiry} onChange={event => { setPortalApprovals(old => ({ ...old, [portal]: { ...row, expiry: event.target.value, approved: false } })); setConfirmed(false); }} /></label>
          <label className="flex items-start gap-2 text-[11px]"><input type="checkbox" disabled={!resumeApproved || !row.account.trim() || !row.expiry} checked={row.approved} onChange={event => { setPortalApprovals(old => ({ ...old, [portal]: { ...row, approved: event.target.checked } })); setConfirmed(false); }} />I verified this {portal} account and updated its stored profile and resume to the exact approved resume above. I approve in-place applications using that portal profile until this expiry.</label>
        </div>)}
      </fieldset>
      <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" disabled={disabled} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked every populated fact and its scope/expiry; these are my factual answers.</label>
      {error && <p role="alert" className="text-[12px] text-red-400">{error}</p>}
      <button type="submit" className={btnPrimary + btnSm} disabled={disabled || !confirmed}>Confirm my profile</button>
    </form>
  </section>;
}
