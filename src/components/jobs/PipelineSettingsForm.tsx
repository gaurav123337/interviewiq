import { useState, type FormEvent } from "react";
import { btnPrimary, btnSm } from "../ui";
import { type PipelineSettings } from "../../services/applyPipeline";

const comma = (value: string) => [...new Set(value.split(",").map(x => x.trim()).filter(Boolean))];
export function PipelineSettingsForm({ value, busy, canEdit, onSave }: {
  value: PipelineSettings; busy: boolean; canEdit: boolean; onSave: (settings: PipelineSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [roles, setRoles] = useState(value.roles.join(", "));
  const [locations, setLocations] = useState(value.locations.join(", "));
  const [countries, setCountries] = useState(value.countries.join(", "));
  const [companies, setCompanies] = useState(value.excludeCompanies.join(", "));
  const [salary, setSalary] = useState(value.minimumSalary ? String(value.minimumSalary.value) : "");
  const [currency, setCurrency] = useState(value.minimumSalary?.currency ?? "");
  const [period, setPeriod] = useState<"year" | "month" | "hour">(value.minimumSalary?.period ?? "year");
  const [quietFrom, setQuietFrom] = useState(value.quietFrom ?? "");
  const [quietTo, setQuietTo] = useState(value.quietTo ?? "");
  const disabled = busy || !canEdit;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const settings = { ...draft, roles: comma(roles), locations: comma(locations), countries: comma(countries).map(x => x.toUpperCase()), excludeCompanies: comma(companies) };
    delete settings.minimumSalary; delete settings.quietFrom; delete settings.quietTo;
    if (salary.trim()) settings.minimumSalary = { value: Number(salary), currency: currency.trim().toUpperCase(), period };
    if (quietFrom || quietTo) { settings.quietFrom = quietFrom; settings.quietTo = quietTo; }
    await onSave(settings);
  };
  return <section className="rounded-xl border border-line/10 bg-deep/30 p-4" aria-label="Pipeline preferences">
    <h4 className="text-[14px] font-bold">Preferences and autonomy</h4>
    <p className="mt-1 text-[12px] text-fnt">Matching uses confirmed skills and explicit filters, not claims inferred from a job description. An enabled pipeline still needs a paired local worker. Auto-submit is a separate opt-in; unknown forms, legal consent and demographic questions require human review.</p>
    <form onSubmit={event => void submit(event)} className="mt-3 space-y-3">
      <fieldset disabled={disabled} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12px]">Target roles (comma separated)<input className="inp mt-1 w-full" aria-label="Pipeline target roles" value={roles} onChange={event => setRoles(event.target.value)} /></label>
          <label className="text-[12px]">Locations (comma separated)<input className="inp mt-1 w-full" aria-label="Pipeline locations" value={locations} onChange={event => setLocations(event.target.value)} /></label>
          <label className="text-[12px]">Countries (ISO codes)<input className="inp mt-1 w-full" aria-label="Pipeline countries" placeholder="IN, US" value={countries} onChange={event => setCountries(event.target.value)} /></label>
          <label className="text-[12px]">Excluded employers<input className="inp mt-1 w-full" aria-label="Excluded pipeline employers" value={companies} onChange={event => setCompanies(event.target.value)} /></label>
          <label className="text-[12px]">Minimum salary<input className="inp mt-1 w-full" aria-label="Minimum pipeline salary" type="number" min="0" step="any" value={salary} onChange={event => setSalary(event.target.value)} /></label>
          <label className="text-[12px]">Salary currency (ISO code)<input className="inp mt-1 w-full" aria-label="Pipeline salary currency" placeholder="INR / USD" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value)} /></label>
          <label className="text-[12px]">Salary period<select className="inp mt-1 w-full" aria-label="Pipeline salary period" value={period} onChange={event => setPeriod(event.target.value as typeof period)}><option value="year">Per year</option><option value="month">Per month</option><option value="hour">Per hour</option></select></label>
          <label className="text-[12px]">Confirmed skill match threshold (%)<input className="inp mt-1 w-full" aria-label="Pipeline match threshold" type="number" min="0" max="100" value={draft.threshold} onChange={event => setDraft(old => ({ ...old, threshold: Number(event.target.value) }))} /></label>
          <label className="text-[12px]">Maximum posting age (days)<input className="inp mt-1 w-full" aria-label="Pipeline maximum posting age" type="number" min="1" max="90" value={draft.maxAgeDays} onChange={event => setDraft(old => ({ ...old, maxAgeDays: Number(event.target.value) }))} /></label>
          <label className="text-[12px]">Time zone<input className="inp mt-1 w-full" aria-label="Pipeline time zone" value={draft.timeZone} onChange={event => setDraft(old => ({ ...old, timeZone: event.target.value }))} /></label>
          <label className="text-[12px]">Daily application cap<input className="inp mt-1 w-full" aria-label="Pipeline daily cap" type="number" min="0" max="100" value={draft.dailyCap} onChange={event => setDraft(old => ({ ...old, dailyCap: Number(event.target.value) }))} /></label>
          <label className="text-[12px]">Weekly application cap<input className="inp mt-1 w-full" aria-label="Pipeline weekly cap" type="number" min="0" max="500" value={draft.weeklyCap} onChange={event => setDraft(old => ({ ...old, weeklyCap: Number(event.target.value) }))} /></label>
          <label className="text-[12px]">Per-employer daily cap<input className="inp mt-1 w-full" aria-label="Pipeline employer daily cap" type="number" min="0" max="20" value={draft.employerDailyCap} onChange={event => setDraft(old => ({ ...old, employerDailyCap: Number(event.target.value) }))} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px]">Quiet from<input className="inp mt-1 w-full" aria-label="Pipeline quiet from" type="time" value={quietFrom} onChange={event => setQuietFrom(event.target.value)} /></label>
            <label className="text-[12px]">Quiet to<input className="inp mt-1 w-full" aria-label="Pipeline quiet to" type="time" value={quietTo} onChange={event => setQuietTo(event.target.value)} /></label>
          </div>
        </div>
        <p className="text-[11px] text-mut">Salary filters require the same currency and period; missing salary data is not silently converted. Work authorization is not inferred from citizenship or sponsorship.</p>
        <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" checked={draft.requireWorkAuthorization} onChange={event => setDraft(old => ({ ...old, requireWorkAuthorization: event.target.checked }))} />Require confirmed country-specific work authorization</label>
        <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" checked={draft.allowSponsorship} onChange={event => setDraft(old => ({ ...old, allowSponsorship: event.target.checked }))} />Include roles requiring sponsorship where I have separately confirmed that requirement</label>
        <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft(old => ({ ...old, enabled: event.target.checked }))} />Enable my autonomous pipeline on my paired worker</label>
        <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" checked={draft.autoSubmit} onChange={event => setDraft(old => ({ ...old, autoSubmit: event.target.checked }))} />Allow automatic submission only after factual, session, board-policy and budget checks pass</label>
        <p className="text-[11px] text-mut">AI assistance is not installed in this release. No provider receives your resume; AI consent stays off.</p>
      </fieldset>
      <button className={btnPrimary + btnSm} disabled={disabled} type="submit">Save pipeline preferences</button>
    </form>
  </section>;
}
