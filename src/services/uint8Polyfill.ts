/* ES2024 Uint8Array#toHex / Uint8Array.fromHex — pdfjs-dist 6.x relies on
   them for document fingerprint hashing, but Chromium < 139, Safari < 18.2
   and Node < 22.15 don't ship them yet. Spec-compliant, non-enumerable,
   installed only when missing (modern engines use the native version). */

export function ensureUint8Polyfills(): void {
  const proto = Uint8Array.prototype as Uint8Array & { toHex?: (this: Uint8Array) => string };
  if (typeof proto.toHex !== "function") {
    Object.defineProperty(proto, "toHex", {
      value(this: Uint8Array): string {
        let s = "";
        for (let i = 0; i < this.length; i++) {
          s += this[i].toString(16).padStart(2, "0");
        }
        return s;
      },
      writable: true,
      configurable: true
    });
  }
  if (typeof (Uint8Array as unknown as { fromHex?: (hex: string) => Uint8Array }).fromHex !== "function") {
    Object.defineProperty(Uint8Array, "fromHex", {
      value(hex: string): Uint8Array {
        const out = new Uint8Array(hex.length >> 1);
        for (let i = 0; i < hex.length; i += 2) {
          out[i >> 1] = parseInt(hex.slice(i, i + 2), 16);
        }
        return out;
      },
      writable: true,
      configurable: true
    });
  }
}

/* self-apply on import — order-insensitive: idempotent, so double calls from
   the main thread and the worker entry are harmless. */
ensureUint8Polyfills();
