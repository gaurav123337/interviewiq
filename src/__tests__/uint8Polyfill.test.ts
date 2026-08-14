/* ES2024 Uint8Array#toHex / fromHex polyfill — pdfjs-dist 6.x requires them
   on every engine; old Chromium/Safari don't ship them. These tests verify
   the polyfill installs and behaves spec-compatibly either way. */

import { describe, expect, it } from "vitest";
import { ensureUint8Polyfills } from "../services/uint8Polyfill";

type Hexable = Uint8Array & { toHex: () => string };
type HexableCtor = typeof Uint8Array & { fromHex: (h: string) => Uint8Array };

const hex = (b: Uint8Array): string => (b as Hexable).toHex();

describe("ensureUint8Polyfills", () => {
  it("installs toHex when missing and matches the spec output", () => {
    ensureUint8Polyfills();
    const fn = (Uint8Array.prototype as unknown as { toHex?: () => string }).toHex;
    expect(typeof fn).toBe("function");
    /* deadbeef, plus leading zeroes are preserved per the spec */
    expect(hex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef");
    expect(hex(new Uint8Array([0x00, 0x0f, 0x10, 0xff]))).toBe("000f10ff");
    expect(hex(new Uint8Array([]))).toBe("");
  });

  it("installs fromHex when missing and round-trips toHex", () => {
    ensureUint8Polyfills();
    const fromHex = (Uint8Array as unknown as { fromHex?: (h: string) => Uint8Array }).fromHex;
    expect(typeof fromHex).toBe("function");
    expect(Array.from((Uint8Array as HexableCtor).fromHex("deadbeef"))).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect((Uint8Array as HexableCtor).fromHex("000f").length).toBe(2);
  });

  it("is idempotent — repeated calls never overwrite an existing implementation", () => {
    ensureUint8Polyfills();
    ensureUint8Polyfills();
    const fn = (Uint8Array.prototype as unknown as { toHex?: () => string }).toHex;
    expect(hex(new Uint8Array([1, 2, 3]))).toBe("010203");
    expect(typeof fn).toBe("function");
  });
});
