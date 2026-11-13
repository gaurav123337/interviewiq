import { notifyTimeZone, TELEGRAM_CHAT_RE, TELEGRAM_TOKEN_RE } from "./telegramNotify.ts";

Deno.test("Telegram candidate grammar cannot modify the fixed HTTPS host or path", () => {
  for (const token of ["123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd", "987654321:ABCDEFGHIJKLMNOPQRSTUVWX-wxyz"]) {
    if (!TELEGRAM_TOKEN_RE.test(token)) throw new Error("valid token rejected");
  }
  for (const token of ["123456:../../evil", "https://evil.example", "123456:ABC?redirect=evil", "123456:ABC\nDEF", "1:a"]) {
    if (TELEGRAM_TOKEN_RE.test(token)) throw new Error("unsafe token admitted");
  }
  for (const chat of ["123456789", "-100123456789"]) {
    if (!TELEGRAM_CHAT_RE.test(chat)) throw new Error("valid chat rejected");
  }
  for (const chat of ["0", "-0", "+123", "1.0", "1/evil", "123456789012345678901"]) {
    if (TELEGRAM_CHAT_RE.test(chat)) throw new Error("invalid chat admitted");
  }
});

Deno.test("notification timezone has explicit UTC default and only valid IANA input", () => {
  if (notifyTimeZone() !== "UTC" || notifyTimeZone(" UTC ") !== "UTC") throw new Error("UTC default changed");
  for (const zone of ["Asia/Kolkata", "Europe/London", "America/New_York"]) {
    if (!notifyTimeZone(zone)) throw new Error("valid IANA timezone rejected");
  }
  for (const zone of ["", "Not/A_Zone", "+05:30", "-08", " +00:00 ", "x".repeat(101), null, 123]) {
    let rejected = false;
    try { notifyTimeZone(zone); } catch { rejected = true; }
    if (!rejected) throw new Error("invalid timezone admitted");
  }
});
