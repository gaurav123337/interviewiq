import { useMemo, useState, useEffect } from "react";
import { CONFIG } from "../../config";
import { fetchSecretStatus, sendTestEmail, type SecretStatusReport, type SecretStatusRow } from "../../services/secrets";
import { getAiProviderConfig, saveAiProviderConfig, testAiProvider, type AiProviderStatus } from "../../services/aiProvider";
import { getEdgeSecrets, saveEdgeSecret, APP_MANAGED_SECRETS, type EdgeSecretStatus } from "../../services/edgeSecrets";
import { toast } from "../../toast";
import { cardCls, btnPrimary, btnGhost, btnSm, Chip } from "../ui";

/* ------------------------------------------------------------------ */
/* AI pipeline provider — the live key/base/model the AI cleaner and the
   AI problem bank use. Stored in the private ai_provider_config table
   (admin-only RLS), editable HERE — no GitHub Actions secret edits. */
/* ------------------------------------------------------------------ */

function AiPipelineCard({ status, onLoad, onToast }: { status: AiProviderStatus | null; onLoad: () => void; onToast: (m: string) => void }) {
  const [key, setKey] = useState("");
  const [base, setBase] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState<string | null>(null);

  useEffect(() => {
    if (status) {
      setBase(status.base || "https://openrouter.ai/api/v1");
      setModel(status.model || "");
    }
  }, [status]);

  const save = async () => {
    /* guard: a model ID (vendor/name, e.g. nvidia/nemotron-3.5-lightning:free)
       is NOT a key — catching this here stops a broken config from silently
       ​​killing every AI run until someone reads the workflow logs */
    const k = key.trim();
    if (/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:-]+$/.test(k)) {
      onToast("✗ That looks like a MODEL name — paste your API key here (sk-…); the model goes in the Model field");
      return;
    }
    setSaving(true);
    setTestNote(null);
    try {
      await saveAiProviderConfig({ key: k, base, model });
      onToast("🤖 AI pipeline key saved — the next scrape/problem-bank run uses it");
      setKey("");
      await onLoad();
    } catch (e) {
      onToast("✗ " + ((e as Error).message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestNote(null);
    try {
      const r = await testAiProvider({ key, base });
      setTestNote((r.ok ? "✅ " : "✗ ") + r.note);
    } catch (e) {
      setTestNote("✗ " + ((e as Error).message || "Test failed"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold">🤖 AI pipeline provider</h2>
          <p className="mt-1 max-w-[700px] text-[12.5px] text-mut">
            The <span className="font-bold">live key/model</span> the AI cleaner and AI problem bank use. Saved to your own
            Supabase project (private, admin-only) and read by the workflows — so you change it{" "}
            <span className="font-bold">here</span>, never on the GitHub dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            status.configured ? (
              <Chip tone="ok">✅ Configured · {status.keyHint}{status.model ? ` · ${status.model}` : ""}</Chip>
            ) : (
              <Chip tone="warn">⚠️ Not configured — AI cleaning + problem bank idle</Chip>
            )
          )}
          <button className={btnGhost + btnSm} onClick={onLoad} disabled={saving}>Refresh</button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11.5px] font-bold text-fnt">Base URL</span>
          <input
            type="text"
            value={base}
            onChange={e => setBase(e.target.value)}
            placeholder="https://openrouter.ai/api/v1"
            className="mt-1 w-full rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11.5px] font-bold text-fnt">Model</span>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="deepseek/deepseek-chat"
            className="mt-1 w-full rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-[11.5px] font-bold text-fnt">API key {status?.configured && <span className="font-normal text-mut">(leave blank to keep the saved one)</span>}</span>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder={status?.configured ? status.keyHint : "sk-or-v1-…"}
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
        />
      </label>

      {testNote && <p className={`mt-2 text-[12px] ${testNote.startsWith("✅") ? "text-ok" : "text-warn"}`}>{testNote}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btnPrimary + btnSm} onClick={() => void save()} disabled={saving || testing}>
          {saving ? "Saving…" : "💾 Save key"}
        </button>
        <button className={btnGhost + btnSm} onClick={() => void test()} disabled={saving || testing} title="One live call to the provider's /models endpoint with the entered key">
          {testing ? "Testing…" : "🧪 Test key"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App-managed Edge Function secrets — the credentials the admin edits  */
/* day-to-day (Resend, Adzuna, GitHub, Safe Browsing). Stored in the    */
/* private edge_secrets table, editable HERE — no dashboard visits.     */
/* ------------------------------------------------------------------ */

const EDGE_SECRET_LABELS: Record<string, { label: string; placeholder: string; note: string }> = {
  RESEND_API_KEY: { label: "Resend API key", placeholder: "re_…", note: "Emails (digests, recovery backup, refunds). Blank = keep the saved one." },
  ADZUNA_APP_ID: { label: "Adzuna app ID", placeholder: "…", note: "Job salary enrichment (jobs-fetch)." },
  ADZUNA_APP_KEY: { label: "Adzuna app key", placeholder: "…", note: "Job salary enrichment (jobs-fetch)." },
  GITHUB_TOKEN: { label: "GitHub token", placeholder: "ghp_…", note: "Trends release recency — works keyless too." },
  SAFE_BROWSING_API_KEY: { label: "Safe Browsing API key", placeholder: "AIza…", note: "Resource URL reputation — otherwise verdicts stay 'pending'." }
};

function EdgeSecretsCard({ statuses, onLoad, onToast }: { statuses: EdgeSecretStatus[] | null; onLoad: () => void; onToast: (m: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (name: string) => {
    setSaving(name);
    try {
      await saveEdgeSecret(name, values[name] ?? "");
      onToast(`🔑 ${EDGE_SECRET_LABELS[name].label} saved — the next function call uses it`);
      setValues(v => ({ ...v, [name]: "" }));
      await onLoad();
    } catch (e) {
      onToast("✗ " + ((e as Error).message || "Save failed"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold">🔐 App-managed secrets</h2>
          <p className="mt-1 max-w-[700px] text-[12.5px] text-mut">
            The credentials you actually change day-to-day live in your own Supabase project (private, admin-only) —
            save them <span className="font-bold">here</span>, never on the dashboard. The edge functions read this table first and
            fall back to the old dashboard secrets, so saving here is all that's needed.
          </p>
        </div>
        <button className={btnGhost + btnSm} onClick={onLoad} disabled={!!saving}>Refresh</button>
      </div>

      {!statuses ? (
        <p className="mt-3 text-[12px] text-mut"><span className="spinner inline-block" /> Loading…</p>
      ) : (
        <div className="mt-3 space-y-3">
          {APP_MANAGED_SECRETS.map(name => {
            const meta = EDGE_SECRET_LABELS[name];
            const st = statuses.find(s => s.name === name);
            return (
              <div key={name} className="rounded-xl border border-line/15 bg-deep/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-fnt">{meta.label} <code className="font-mono text-mut">{name}</code></span>
                  {st?.configured
                    ? <Chip tone="ok">✅ Set · {st.keyHint}</Chip>
                    : <Chip tone="warn">⚠️ Not set — env fallback only</Chip>}
                </div>
                <p className="mt-1 text-[11.5px] text-mut">{meta.note}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={values[name] ?? ""}
                    onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))}
                    placeholder={st?.configured ? `${st.keyHint} — blank keeps it` : meta.placeholder}
                    autoComplete="off"
                    className="min-w-[220px] flex-1 rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                  />
                  <button className={btnPrimary + btnSm} onClick={() => void save(name)} disabled={saving === name || !(values[name] ?? "").trim()}>
                    {saving === name ? "Saving…" : "💾 Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Secrets — which Edge Function secrets are configured vs missing.    */
/* Backed by the secret-status Edge Function (server-side presence      */
/* check via Deno.env.has — values are never readable or returned).    */
/* ------------------------------------------------------------------ */

export function SecretsSection() {
  const [report, setReport] = useState<SecretStatusReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiProviderStatus | null>(null);

  const loadAi = async () => {
    try {
      setAiStatus(await getAiProviderConfig());
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load AI pipeline config"));
    }
  };

  const [edgeSecrets, setEdgeSecrets] = useState<EdgeSecretStatus[] | null>(null);

  const loadEdgeSecrets = async () => {
    try {
      setEdgeSecrets(await getEdgeSecrets());
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load app-managed secrets"));
    }
  };

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await fetchSecretStatus());
    } catch (e) {
      setReport(null);
      setError((e as Error).message || "Failed to load secret status");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); void loadAi(); void loadEdgeSecrets(); }, []);

  /* one-click RESEND_API_KEY validation. Defaults to the admin's own
     inbox; a recipient can be supplied because Resend TEST keys only
     deliver to the key owner's address (e.g. a garudagaura@gmail.com-owned
     key), so testing against that inbox proves the key end-to-end. */
  const test = async () => {
    setTesting(true);
    try {
      const r = await sendTestEmail(testTo.trim() || undefined);
      toast(r.sent ? "📧 " + (r.note ?? "Test email sent — check your inbox") : "✗ " + (r.note ?? "Send failed"));
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Test email failed"));
    } finally {
      setTesting(false);
    }
  };

  /* missing required → missing optional → set → auto-injected (builtin) */
  const rows = useMemo(() => {
    if (!report) return [];
    const order = (s: SecretStatusRow): number =>
      s.builtin ? 3 : s.configured ? 2 : s.required ? 0 : 1;
    return [...report.secrets].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  }, [report]);

  const statusChip = (s: SecretStatusRow) => {
    if (s.builtin) return <Chip tone="default">🔒 Auto-injected</Chip>;
    if (s.configured) return <Chip tone="ok">✅ Set</Chip>;
    return s.required ? <Chip tone="bad">⚠️ Missing</Chip> : <Chip tone="warn">⚠️ Missing (optional)</Chip>;
  };

  const projectRef = CONFIG.supabase.url.replace("https://", "").replace(".supabase.co", "");

  return (
    <div className="space-y-4">
      <AiPipelineCard status={aiStatus} onLoad={loadAi} onToast={toast} />
      <EdgeSecretsCard statuses={edgeSecrets} onLoad={loadEdgeSecrets} onToast={toast} />
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold">🔑 Edge Function secrets</h2>
            <p className="mt-1 max-w-[700px] text-[12.5px] text-mut">
              Which secrets the Edge Functions need to fully work — <span className="font-bold">configured vs missing</span>, checked
              from the function runtime. Supabase never exposes secret <span className="font-bold">values</span>, so this reports presence only;
              a missing <span className="font-bold">required</span> secret means a feature is silently degraded (emails answer sent:false,
              crons 401, verdicts stay pending).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="Send to (defaults to your email)"
              className="w-56 rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
              title="Resend TEST keys only deliver to the key owner's inbox — enter that address to validate the key"
            />
            <button className={btnPrimary + btnSm} onClick={() => void test()} disabled={testing || busy} title="Sends a test email to validate RESEND_API_KEY end-to-end (admin-only recipient choice)">
              {testing ? "Sending…" : "📧 Send test email"}
            </button>
            <button className={btnGhost + btnSm} onClick={() => void load()} disabled={busy}>Refresh</button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-[12.5px] text-warn">
            <span className="font-bold">Couldn't read secret status.</span> {error}
            <div className="mt-1.5 text-mut">
              If the function isn't deployed yet, run{" "}
              <code className="font-mono">supabase functions deploy secret-status --project-ref {projectRef}</code>{" "}
              (or re-run <code className="font-mono">scripts/setup-live.js</code>) and hit Refresh.
            </div>
          </div>
        )}

        {busy && !report && !error && <p className="mt-3 text-[12px] text-mut"><span className="spinner inline-block" /> Checking…</p>}

        {report && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={report.summary.missingRequired > 0 ? "bad" : "ok"}>
              {report.summary.configured}/{report.summary.total} secrets in place
            </Chip>
            {report.summary.missingRequired > 0 && (
              <Chip tone="bad">{report.summary.missingRequired} required missing — setup isn't finished</Chip>
            )}
            {report.summary.missingRequired === 0 && report.summary.missingOptional > 0 && (
              <Chip tone="warn">{report.summary.missingOptional} optional missing — degraded, not broken</Chip>
            )}
            {report.summary.missingRequired === 0 && report.summary.missingOptional === 0 && (
              <Chip tone="ok">All required secrets configured 🎉</Chip>
            )}
            <Chip tone={report.serviceRoleAvailable ? "ok" : "bad"}>
              {report.serviceRoleAvailable ? "✅ Service-role access available" : "⚠️ No service-role key — admin functions can't reach the DB"}
            </Chip>
          </div>
        )}
      </div>

      {report && rows.length > 0 && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-panel text-[11px] uppercase tracking-wider text-fnt">
                <tr>
                  <th className="px-5 py-2">Secret</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Needed by</th>
                  <th className="px-5 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.name} className={`border-t border-line/10 ${!s.configured && !s.builtin && s.required ? "bg-warn/5" : ""}`}>
                    <td className="px-5 py-2 font-mono text-[11.5px] font-bold text-ink">{s.name}</td>
                    <td className="px-3 py-2">{statusChip(s)}</td>
                    <td className="max-w-[260px] px-3 py-2 text-fnt">{s.functions.join(", ")}</td>
                    <td className="max-w-[280px] px-5 py-2 text-mut">{s.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="px-1 text-[11.5px] text-mut">
        Where to add secrets: Supabase dashboard → Edge Functions → Secrets — secrets are project-wide, so every
        function sees them (one <code className="font-mono">RESEND_API_KEY</code> covers all digest, backup and refund emails).
        Or set them one-command via <code className="font-mono">scripts/setup-live.js</code> with a personal access token.
        Values can't be read back once saved — only replaced.
      </p>
    </div>
  );
}



