/* 🔑 Site credentials (admin) — store logins per board from the app itself.
   One credential can be BOUND to many sites that share the same auth
   (clubbing: e.g. one Google account across instahyre + indeed). The engine
   uses bound credentials to re-login automatically when a saved session
   dies. Secrets never return to the client — the list shows prefixes only.
   The add-URL box registers new boards directly (no discovery needed). */

import { useCallback, useEffect, useState } from "react";
import {
  listCredentials, putCredential, deleteCredential, bindCredential, addJobSiteUrl,
  listJobSites, type SiteCredential, type JobSite,
} from "../../services/jobSites.ts";

export default function CredentialsPanel() {
  const [creds, setCreds] = useState<SiteCredential[] | null>(null);
  const [sites, setSites] = useState<JobSite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<SiteCredential["kind"]>("password");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [url, setUrl] = useState("");
  const [urlNote, setUrlNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [c, s] = await Promise.all([listCredentials(), listJobSites()]);
      setCreds(c);
      setSites(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreds([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addCred = async () => {
    if (!label.trim() || !secret.trim()) { setError("Label and secret are required"); return; }
    setBusy("new");
    try {
      await putCredential(null, label.trim(), kind, username.trim(), secret.trim());
      setLabel(""); setUsername(""); setSecret("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const addUrl = async () => {
    if (!/^https?:\/\//.test(url.trim())) { setUrlNote("Paste a full URL starting with https://"); return; }
    setBusy("url");
    try {
      const res = await addJobSiteUrl(url.trim());
      setUrlNote(`✓ ${res}`);
      setUrl("");
      await refresh();
    } catch (e) { setUrlNote((e as Error).message); }
    finally { setBusy(null); }
  };

  const bind = async (host: string, id: string | null) => {
    setBusy(host);
    try { await bindCredential(host, id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const del = async (id: string) => {
    setBusy(id);
    try { await deleteCredential(id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const activeSites = sites.filter(s => s.status === "active" || s.status === "pending");

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-200">🔑 Logins & credentials</div>
        <button onClick={() => void refresh()} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>
      </div>
      <div className="mb-2 text-xs text-zinc-500">
        Store a login once and bind it to every board that shares it — the engine re-logins automatically when a saved
        session dies. Secrets stay server-side; this list shows prefixes only. Add new job URLs below too — manual adds
        join the rotation <b>active</b> immediately.
      </div>
      {error && <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}

      {/* add credential */}
      <div className="mb-3 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
        <div className="text-xs font-semibold text-zinc-300">Add a credential</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="label (e.g. My Google account)"
            className="w-44 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
          <select value={kind} onChange={e => setKind(e.target.value as SiteCredential["kind"])}
            className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" title="password = email+password, oauth = Google/SSO email link, otp = one-time codes">
            <option value="password">password</option>
            <option value="oauth">oauth (Google/SSO)</option>
            <option value="otp">otp</option>
            <option value="manual">manual</option>
          </select>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username / email"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
          <input value={secret} onChange={e => setSecret(e.target.value)} placeholder="secret (password / recovery code)" type="password"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
          <button onClick={() => void addCred()} disabled={busy === "new"} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Save</button>
        </div>
      </div>

      {/* add job URL */}
      <div className="mb-3 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
        <div className="text-xs font-semibold text-zinc-300">Add a job-board URL</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/jobs?role=frontend"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
          <button onClick={() => void addUrl()} disabled={busy === "url"} className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50">Add site</button>
        </div>
        {urlNote && <div className="text-[11px] text-zinc-400">{urlNote}</div>}
      </div>

      {/* credential list with bindings */}
      {creds?.length === 0 && <div className="text-xs text-zinc-500">No credentials stored yet.</div>}
      <div className="space-y-1.5">
        {creds?.map(c => (
          <div key={c.id} className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-400">{c.kind}</span>
              <span className="text-sm text-zinc-200">{c.label}</span>
              {c.username && <span className="text-xs text-zinc-500">· {c.username}</span>}
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{c.secret_prefix}••</span>
              {busy === c.id ? <span className="text-xs text-zinc-500">…</span> : (
                <button onClick={() => void del(c.id)} className="ml-auto rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-400 hover:border-red-600 hover:text-red-400">🗑</button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">bound to:</span>
              {activeSites.map(s => (
                <button key={s.id}
                  onClick={() => void bind(s.host, s.credential_id === c.id ? null : c.id)}
                  title={s.credential_id === c.id ? "Click to unbind" : "Click to bind this credential"}
                  className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium border ${s.credential_id === c.id ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                  {s.credential_id === c.id ? "✓ " : ""}{s.host}
                </button>
              ))}
              {busy === "bind" && <span className="text-[11px] text-zinc-500">…</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
