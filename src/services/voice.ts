/* Browser voice for the interview: speech-to-text (answers — the free mic
   button) and text-to-speech (the interviewer reading questions aloud in
   Voice mode). Zero dependencies: the Web Speech API ships in Chromium-based
   browsers and keeps everything on-device + offline. */

interface SRWindow {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

export function sttSupported(): boolean {
  const w = window as unknown as SRWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let voices: SpeechSynthesisVoice[] = [];
let loaded = false;

/** Warms the voice list (browsers populate it asynchronously). */
export function loadVoices(): void {
  if (loaded || !ttsSupported()) return;
  loaded = true;
  voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
    };
  }
}

/** Speaks a line with a natural English voice (best-effort, fire-and-forget). */
export function speak(text: string): void {
  if (!ttsSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  const en = voices.find(v => v.lang.toLowerCase().startsWith("en") && v.localService)
    ?? voices.find(v => v.lang.toLowerCase().startsWith("en"));
  if (en) u.voice = en;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
