import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const switchLang = (code: string) => {
    void i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Change language"
        aria-label="Change language"
        className="grid h-9 w-9 place-items-center rounded-xl border border-line/15 bg-wht/10 text-[16px] transition-all hover:bg-wht/20"
      >
        {current.flag}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl border border-line/10 bg-deep/95 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => switchLang(l.code)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold transition-all ${
                l.code === i18n.language
                  ? "grad-bg-soft border border-acc1/40 text-acctxt"
                  : "text-fnt hover:bg-wht/10 hover:text-ink"
              }`}
            >
              <span className="text-[16px]">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.code === i18n.language && <span className="text-[10px] font-extrabold text-acc3">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
