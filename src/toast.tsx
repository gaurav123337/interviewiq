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
      setTimeout(() => setItems(x => x.map(i => (i.id === id ? { ...i, leaving: true } : i))), 2600);
      setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 2950);
    };
    listeners.push(l);
    return () => { listeners = listeners.filter(x => x !== l); };
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map(i => (
        <div
          key={i.id}
          className={`rounded-xl border border-white/25 bg-[#1b2745] px-5 py-3 text-sm font-semibold text-ink shadow-[0_14px_40px_rgba(0,0,0,.5)] ${i.leaving ? "anim-fade opacity-0 transition-opacity duration-300" : "anim-pop"}`}
        >
          {i.msg}
        </div>
      ))}
    </div>
  );
}
