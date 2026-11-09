/* The tester has no writable live mode. Keep policy independent of Playwright
   so production denial can be verified without ever contacting a real service. */
export const FIXTURE_ORIGIN = "https://virtual-tester.invalid";
export const LOCAL_SITES = ["http://127.0.0.1:8140/interviewiq/", "http://127.0.0.1:8141/"];
export const LIVE_SITES = ["https://gaurav123337.github.io/interviewiq/", "https://job-assist.wasmer.app/"];
export const PROXY_URL = "http://127.0.0.1:8149";

export function isStaticRequest(rawUrl, method, baseURL) {
  if (!["GET", "HEAD"].includes(method)) return false;
  let url, base;
  try { url = new URL(rawUrl); base = new URL(baseURL); } catch { return false; }
  if (url.origin !== base.origin || url.username || url.password) return false;
  if (!url.pathname.startsWith(base.pathname)) return false;
  const path = url.pathname.slice(base.pathname.length);
  return path === "" || path === "index.html" || path === "sw.js" ||
    path === "manifest.webmanifest" || /^(?:assets|icons)\/[A-Za-z0-9_./-]+\.(?:js|css|woff2?|png|jpe?g|svg|ico|webp|wasm)$/.test(path);
}

export function requestPolicy(rawUrl, method, baseURL, mode) {
  const allowedSites = mode === "live" ? LIVE_SITES : LOCAL_SITES;
  if (!allowedSites.includes(baseURL)) return "deny";
  if (isStaticRequest(rawUrl, method, baseURL)) return "static";
  let url;
  try { url = new URL(rawUrl); } catch { return "deny"; }
  if (mode === "fixture" && rawUrl === "https://checkout.razorpay.com/v1/checkout.js" && method === "GET") return "checkout-fixture";
  if (mode === "fixture" && url.origin === FIXTURE_ORIGIN && !url.username && !url.password) return "fixture";
  return "deny";
}

export function proxyTarget(rawUrl, method) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== "http:" || url.username || url.password || !["GET", "HEAD"].includes(method)) return null;
  return LOCAL_SITES.some(base => isStaticRequest(rawUrl, method, base)) ? url : null;
}

export function assertIsolatedBuild(mode, url, key, outDir) {
  if (!["fixture", "offline"].includes(mode)) throw new Error("Unknown virtual test build mode");
  if (outDir !== `.virtual-tester/${mode}`) throw new Error("Test builds must not replace production dist");
  if (mode === "fixture" && (url !== FIXTURE_ORIGIN || key !== "sb_publishable_virtual_tester")) {
    throw new Error("Fixture build must use the reserved invalid domain and synthetic public key");
  }
  if (mode === "offline" && (url !== "" || key !== "")) throw new Error("Offline tests require cloud disabled");
}
