import { useSettings } from "./SettingsContext";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip, Seg } from "../ui";

export function CloudSyncSection() {
  const s = useSettings();
  const { cloud } = s;

  return (
    <section className={`${cardCls} p-6`}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-[16px] font-extrabold">☁️ Cloud sync</h2>
        {cloud.user && <Chip tone="ok">SYNCED</Chip>}
        {!cloud.configured && <Chip>OFF</Chip>}
      </div>
      {cloud.user ? (
        <>
          <p className="mb-4 text-[13px] text-mut">
            Signed in as <span className="font-bold text-ink">{cloud.user.email}</span> — your sessions, streaks and drill progress back up to the cloud and restore on any device. Everything still works offline.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button className={btnGhost + btnSm} onClick={async () => { const { cloudSyncNow } = await import("../../services/cloud"); await cloudSyncNow(); }} disabled={cloud.syncing}>
              {cloud.syncing ? <><span className="spinner" />Syncing…</> : "🔄 Sync now"}
            </button>
            <button className={btnDanger + btnSm} onClick={async () => { const { cloudSignOut } = await import("../../services/cloud"); const { clearServerEntitlement } = await import("../../services/entitlement"); await cloudSignOut(); clearServerEntitlement(); s.setEnt(null); }}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-mut">
            {cloud.configured
              ? "Sign in to back up your sessions, streaks and drill progress across devices. The cloud is an optional mirror — local use stays fully offline."
              : "Back up and restore your progress across devices with optional cloud sync."}
          </p>
          {cloud.configured ? (
            <div className="space-y-3">
              {cloud.oauth.length > 0 && (
                <div className="space-y-2">
                  {cloud.oauth.includes("google") && (
                    <button className={`${btnGhost} w-full py-2.5`} onClick={() => s.doOAuth("google")} disabled={s.cloudBusy}>
                      <span className="mr-2">G</span>Continue with Google
                    </button>
                  )}
                  {cloud.oauth.includes("github") && (
                    <button className={`${btnGhost} w-full py-2.5`} onClick={() => s.doOAuth("github")} disabled={s.cloudBusy}>
                      <span className="mr-2">🐙</span>Continue with GitHub
                    </button>
                  )}
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-wht/10" />
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-mut">or with email</span>
                    <span className="h-px flex-1 bg-wht/10" />
                  </div>
                </div>
              )}
              <Seg options={[{ value: "in", label: "Sign in" }, { value: "up", label: "Create account" }]} value={s.cloudMode} onChange={s.setCloudMode} />
              <input
                type="email" value={s.cloudEmail} onChange={e => s.setCloudEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
              <input
                type="password" value={s.cloudPass} onChange={e => s.setCloudPass(e.target.value)}
                placeholder="Password (min 6 characters)"
                className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
              <button className={btnPrimary + btnSm} onClick={s.doCloudAuth} disabled={s.cloudBusy}>
                {s.cloudBusy ? <><span className="spinner" />…</> : s.cloudMode === "in" ? "Sign in" : "Create account"}
              </button>
              {s.mfaStep === "challenge" && (
                <div className="rounded-xl border border-acc1/30 bg-acc1/10 px-4 py-3">
                  <p className="mb-2 text-[12.5px] font-bold text-acc2">🔐 2-factor authentication</p>
                  {!s.mfaRecoveryMode ? (
                    <>
                      <p className="mb-2 text-[12px] text-mut">This account has an authenticator app. Enter the 6-digit code to finish signing in.</p>
                      <div className="flex gap-2">
                        <input
                          type="text" inputMode="numeric" maxLength={6} value={s.mfaCode}
                          onChange={e => s.setMfaCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="w-32 rounded-xl border border-line/15 bg-deep/80 px-4 py-2 text-center text-[15px] font-bold tracking-[.3em] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                        />
                        <button className={btnPrimary + btnSm} onClick={s.doMfaVerify} disabled={s.mfaBusy}>
                          {s.mfaBusy ? <><span className="spinner" />…</> : "Verify"}
                        </button>
                        <button className={btnGhost + btnSm} onClick={() => { s.setMfaStep("idle"); s.setMfaCode(""); }}>Back</button>
                      </div>
                      <button className="mt-2 text-[11.5px] font-bold text-acctxt underline" onClick={() => s.setMfaRecoveryMode(true)}>
                        Lost your authenticator? Use a recovery code
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-[12px] text-mut">
                        Enter a one-time recovery code from when you set up 2-factor. This removes the authenticator so you can sign in and set up a new one.
                      </p>
                      <input
                        type="email" value={s.cloudEmail} onChange={e => s.setCloudEmail(e.target.value)}
                        placeholder="Account email"
                        className="mb-2 w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                      />
                      <input
                        type="text" value={s.mfaRecoveryCode} onChange={e => s.setMfaRecoveryCode(e.target.value.toUpperCase())}
                        placeholder="XXXXX-XXXXX-XXXXX"
                        className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                      />
                      <div className="mt-2 flex gap-2">
                        <button className={btnPrimary + btnSm} onClick={s.doMfaRecover} disabled={s.recoveryBusy}>
                          {s.recoveryBusy ? <><span className="spinner" />…</> : "Redeem"}
                        </button>
                        <button className={btnGhost + btnSm} onClick={() => { s.setMfaRecoveryMode(false); s.setMfaRecoveryCode(""); }}>Back</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-line/10 bg-wht/5 px-4 py-3 text-[12.5px] text-mut">
              💡 To enable: create a free Supabase project → run the SQL in the README → paste your project URL + anon key into <code className="font-mono text-acc1">src/config.ts</code>.
            </div>
          )}
        </>
      )}
    </section>
  );
}
