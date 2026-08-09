import { useEffect, useState } from "react";
import type { View } from "../store";
import { useApp } from "../store";
import { ToastHost } from "../toast";
import { Onboarding } from "./Onboarding";
import { Interview } from "./Interview";
import { Results } from "./Results";
import { Bank } from "./Bank";
import { History } from "./History";
import { Settings } from "./Settings";

const TABS: { id: View; label: string; icon: string }[] = [
  { id: "onboard", label: "Practice", icon: "🎯" },
  { id: "bank", label: "Bank", icon: "📚" },
  { id: "history", label: "History", icon: "🗂️" },
  { id: "settings", label: "Settings", icon: "⚙️" }
];

interface BIP extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function App() {
  const { state, nav } = useApp();
  const [installEvt, setInstallEvt] = useState<BIP | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIP); };
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const install = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  };

  const view = state.view;

  return (
    <div className="flex min-h-screen flex-col">
      {/* header */}
      <header className="no-print sticky top-0 z-50 border-b border-white/10 bg-[#0a0e1a]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center gap-3 px-4">
          <button className="flex items-center gap-2.5" onClick={() => nav("onboard")}>
            <span className="grid h-9 w-9 place-items-center rounded-xl grad-bg text-[18px] shadow-[0_6px_18px_rgba(99,102,241,.45)]">🎙️</span>
            <span className="text-[17px] font-extrabold tracking-tight">Interview<span className="grad-text">IQ</span></span>
          </button>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {TABS.map(t => (
              <TabBtn key={t.id} icon={t.icon} label={t.label} active={view === t.id} onClick={() => nav(t.id)} />
            ))}
          </nav>
          <span className="flex-1" />
          {!online && <span className="hidden rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-[11.5px] font-bold text-warn sm:inline">Offline — cached</span>}
          {installEvt && (
            <button
              onClick={install}
              className="hidden rounded-xl border border-acc1/50 bg-acc1/15 px-3.5 py-1.5 text-[13px] font-bold text-[#c7caff] transition-all hover:bg-acc1/30 sm:inline-flex"
            >
              ⬇ Install app
            </button>
          )}
        </div>
      </header>

      {/* main */}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-6 md:pb-12">
        {view === "onboard" && <Onboarding />}
        {view === "interview" && <Interview />}
        {view === "results" && <Results />}
        {view === "bank" && <Bank />}
        {view === "history" && <History />}
        {view === "settings" && <Settings />}
      </main>

      {/* bottom nav (mobile) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b1020]/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[1200px] items-stretch justify-around px-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => nav(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${view === t.id ? "text-acc3" : "text-fnt"}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-lg text-[16px] ${view === t.id ? "bg-acc1/20" : ""}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <ToastHost />
    </div>
  );
}

function TabBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-bold transition-all ${active ? "grad-bg-soft border border-acc1/40 text-[#d7dbff]" : "text-mut hover:bg-white/10 hover:text-ink"}`}
    >
      <span>{icon}</span>{label}
    </button>
  );
}
