import { useSettings } from "./SettingsContext";
import { btnDanger, btnGhost, btnSm, cardCls, Modal } from "../ui";

export function DataSection() {
  const s = useSettings();

  return (
    <section className={`${cardCls} p-6`}>
      <h2 className="mb-1 text-[16px] font-extrabold">🗄️ Your data</h2>
      <p className="mb-4 text-[13px] text-mut">All stored locally in this browser — nothing leaves your device unless you add an API key.</p>
      <div className="flex flex-wrap gap-2.5">
        <button className={btnGhost + btnSm} onClick={() => { s.clearHistory(); }} disabled={!s.sessions.length}>
          Clear history ({s.sessions.length})
        </button>
        <button className={btnDanger + btnSm} onClick={() => s.setConfirmReset(true)}>Reset everything</button>
      </div>

      {s.confirmReset && (
        <Modal onClose={() => s.setConfirmReset(false)} title="Reset everything?" desc="Deletes your history, onboarding choices, defaults and API key. This cannot be undone.">
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => s.setConfirmReset(false)}>Cancel</button>
            <button className={btnDanger} onClick={() => { s.setConfirmReset(false); s.resetAll(); }}>Yes, reset</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
