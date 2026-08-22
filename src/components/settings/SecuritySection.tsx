import { useSettings } from "./SettingsContext";
import { generateRecoveryCodes } from "../../services/recoveryCodes";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip } from "../ui";

export function SecuritySection() {
  const s = useSettings();

  return (
    <section className={`${cardCls} p-6`}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-[16px] font-extrabold">🔐 Security</h2>
        {s.mfaFactors.some(f => f.status === "verified") && <Chip tone="ok">TOTP ON</Chip>}
      </div>
      <p className="mb-4 text-[13px] text-mut">
        Two-factor authentication with your authenticator app (Google Authenticator, 1Password, Authy…). When enabled,
        admin actions and sign-ins require a 6-digit code.
      </p>

      {s.mfaFactors.length > 0 && (
        <div className="mb-3 space-y-2">
          {s.mfaFactors.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-line/10 bg-wht/5 px-4 py-2.5">
              <span className="text-[13px]">Authenticator ({f.status === "verified" ? "active" : "awaiting verification"})</span>
              <button className={btnDanger + btnSm} onClick={() => void s.removeMfa(f.id)} disabled={s.mfaBusy}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {s.mfaEnrollInfo ? (
        <div className="space-y-3 rounded-xl border border-acc1/30 bg-acc1/10 px-4 py-4">
          <p className="text-[13px] font-bold text-acc2">Scan with your authenticator app</p>
          <div className="flex flex-wrap items-start gap-4">
            <img src={s.mfaEnrollInfo.qrCode} alt="TOTP QR code" className="h-40 w-40 rounded-lg border border-line/20 bg-white" />
            <div className="min-w-[200px] flex-1 text-[12px] text-mut">
              <p className="mb-1">Or enter this secret manually:</p>
              <code className="break-all rounded bg-deep/80 px-2 py-1 font-mono text-[11.5px] text-ink">{s.mfaEnrollInfo.secret}</code>
              <div className="mt-3 flex gap-2">
                <input
                  type="text" inputMode="numeric" maxLength={6} value={s.mfaVerifyCode}
                  onChange={e => s.setMfaVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-32 rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-center text-[15px] font-bold tracking-[.3em] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                />
                <button className={btnPrimary + btnSm} onClick={s.activateMfa} disabled={s.mfaBusy}>
                  {s.mfaBusy ? <><span className="spinner" />…</> : "Activate"}
                </button>
                <button className={btnGhost + btnSm} onClick={() => { s.setMfaEnrollInfo(null); s.setMfaVerifyCode(""); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        !s.mfaFactors.some(f => f.status === "verified") && (
          <button className={btnPrimary + btnSm} onClick={s.enrollMfa} disabled={s.mfaBusy}>
            {s.mfaBusy ? <><span className="spinner" />…</> : "➕ Set up authenticator app"}
          </button>
        )
      )}

      {s.recoveryStatus && s.recoveryStatus.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-ink">🔑 Recovery codes</p>
            <p className="mt-0.5 text-[12px] text-mut">{s.recoveryStatus.unused} of {s.recoveryStatus.total} unused</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s.recoveryStatus.unused < 3 && <Chip tone="warn">⚠️ Few left — regenerate</Chip>}
            <button className={btnGhost + btnSm} onClick={() => s.setRecoveryCodes(generateRecoveryCodes(10))} disabled={s.recoveryBusy}>
              Regenerate
            </button>
          </div>
        </div>
      )}

      {s.recoveryCodes && (
        <div className="mt-4 rounded-xl border border-co/40 bg-co/10 px-4 py-4">
          <p className="text-[13px] font-bold text-co">🔑 Recovery codes — save these now</p>
          <p className="mt-1 text-[12px] text-mut">
            If you ever lose your authenticator, a one-time code lets you sign back in and reset it. Each code works once —
            store them somewhere safe (password manager). They're shown only once.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-1.5 font-mono text-[12px] sm:grid-cols-2">
            {s.recoveryCodes.map((c, i) => (
              <div key={i} className="rounded-lg bg-deep/70 px-3 py-1.5 text-ink">{c}</div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btnPrimary + btnSm} onClick={s.saveRecovery} disabled={s.recoveryBusy}>
              {s.recoveryBusy ? <><span className="spinner" />…</> : "✅ I've saved them"}
            </button>
            <button className={btnGhost + btnSm} onClick={() => s.setRecoveryCodes(generateRecoveryCodes(10))}>Regenerate</button>
            <button className={btnGhost + btnSm} onClick={s.emailBackup} disabled={s.recoveryBusy}>
              {s.recoveryBusy ? <><span className="spinner" />…</> : "📧 Email me a backup copy"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
