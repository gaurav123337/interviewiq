import { useEffect, useState } from "react";
import { uid } from "./util";

type Listener = (msg: string) => void;
let listeners: Listener[] = [];

export function toast(msg: string) {
  listeners.forEach(l => l(msg));
}

interface Item { id: string; msg: string; leaving: boolean }

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const l: Listener = msg => {
      const id = uid();
      setItems(x => [...x, { id, msg, leaving: false }]);
      // Auto-dismiss after 8 seconds (long enough to read and screenshot)
      setTimeout(() => setItems(x => x.map(i => (i.id === id ? { ...i, leaving: true } : i))), 8000);
      setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 8400);
    };
    listeners.push(l);
    return () => { listeners = listeners.filter(x => x !== l); };
  }, []);

  const dismiss = (id: string) => {
    setItems(x => x.map(i => (i.id === id ? { ...i, leaving: true } : i)));
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 350);
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map(i => (
        <div
          key={i.id}
          className={`flex items-center gap-3 rounded-xl border border-line/25 bg-panel3 px-5 py-3 text-sm font-semibold text-ink shadow-[0_14px_40px_rgba(0,0,0,.5)] ${i.leaving ? "anim-fade opacity-0 transition-opacity duration-300" : "anim-pop"}`}
        >
          <span>{i.msg}</span>
          <button
            onClick={() => dismiss(i.id)}
            className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-wht/10 text-[11px] text-mut hover:bg-wht/20 hover:text-ink transition-colors"
            title="Dismiss"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
