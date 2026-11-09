/* Local-only static servers plus a deny-by-default proxy. The proxy contains
   service-worker and worker traffic that page routing cannot intercept. */
import { createServer, request as httpRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { proxyTarget } from "./virtual-tester-lib.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const servers = [];
for (const [mode, port, prefix] of [["fixture", 8140, "/interviewiq/"], ["offline", 8141, "/"]]) {
  const base = resolve(root, ".virtual-tester", mode);
  const marker = JSON.parse(await readFile(resolve(base, "virtual-build.json"), "utf8"));
  if (marker.mode !== mode) throw new Error("Missing isolated test-build marker");
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === "/__virtual_health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(marker)); return;
      }
      if (!["GET", "HEAD"].includes(req.method) || !url.pathname.startsWith(prefix)) { res.writeHead(403); res.end(); return; }
      const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || "index.html";
      const path = resolve(base, relative);
      if (!path.startsWith(base + sep) || !(await stat(path)).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : await readFile(path));
    } catch { res.writeHead(404); res.end(); }
  });
  server.listen(port, "127.0.0.1");
  servers.push(server);
}
const proxy = createServer((req, res) => {
  const target = proxyTarget(req.url, req.method);
  if (!target) { res.writeHead(403); res.end("Virtual tester: external traffic denied"); return; }
  const upstream = httpRequest(target, { method: req.method, headers: { host: target.host } }, response => {
    res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res);
  });
  upstream.on("error", () => { res.writeHead(502); res.end(); });
  upstream.setTimeout(30_000, () => upstream.destroy());
  upstream.end();
});
proxy.on("connect", (_req, socket) => socket.end("HTTP/1.1 403 Forbidden\r\n\r\n"));
proxy.on("upgrade", (_req, socket) => socket.end("HTTP/1.1 403 Forbidden\r\n\r\n"));
proxy.listen(8149, "127.0.0.1");
servers.push(proxy);
console.log("Virtual tester: fixture 8140, offline 8141, deny proxy 8149 (loopback only)");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { for (const server of servers) server.close(); process.exit(0); });
