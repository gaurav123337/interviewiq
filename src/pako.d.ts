/* Ambient types for pako (a transitive dependency of pdf-lib) — the package
   ships no declarations. Only the surface used by tests is declared. */
declare module "pako" {
  export function inflate(data: Uint8Array): Uint8Array;
}
