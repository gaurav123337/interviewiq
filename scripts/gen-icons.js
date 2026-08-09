/* Generates PWA icons (PNG) with zero dependencies, using Node's built-in zlib.
   Design: gradient rounded square + white chat bubble with three dots. */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ---------- minimal PNG writer ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  /* bit depth */
  ihdr[9] = 6;  /* color type RGBA */
  /* scanlines with filter byte 0 */
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- drawing ---------- */
function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

/* gradient stops: indigo -> purple -> cyan */
function gradientAt(t) {
  if (t < 0.55) return lerpColor([99, 102, 241], [168, 85, 247], t / 0.55);
  return lerpColor([168, 85, 247], [34, 211, 238], (t - 0.55) / 0.45);
}

function inRoundedRect(x, y, w, h, r) {
  if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r;
  if (x > w - r && y < r) return (x - (w - r)) ** 2 + (y - r) ** 2 <= r * r;
  if (x < r && y > h - r) return (x - r) ** 2 + (y - (h - r)) ** 2 <= r * r;
  if (x > w - r && y > h - r) return (x - (w - r)) ** 2 + (y - (h - r)) ** 2 <= r * r;
  return x >= r && x <= w - r && y >= r && y <= h - r;
}

function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const w = size, h = size;
  const r = w * 0.22;
  const cx = w / 2, cy = h / 2;
  const bubbleR = w * 0.28;
  const bubbleCy = cy - w * 0.02;
  /* tail triangle points */
  const t1 = { x: cx - bubbleR * 0.72, y: bubbleCy + bubbleR * 0.62 };
  const t2 = { x: cx - bubbleR * 0.98, y: bubbleCy + bubbleR * 1.08 };
  const t3 = { x: cx - bubbleR * 0.3, y: bubbleCy + bubbleR * 0.95 };
  const dotR = w * 0.045;
  const dotY = bubbleCy;
  const dots = [cx - bubbleR * 0.45, cx, cx + bubbleR * 0.45];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r_ = 0, g = 0, b = 0, a = 0;

      if (inRoundedRect(x, y, w, h, r)) {
        const t = (x + y) / (w + h);
        const c = gradientAt(Math.max(0, Math.min(1, t)));
        r_ = c[0]; g = c[1]; b = c[2]; a = 255;
        /* subtle inner glow */
        const glow = Math.max(0, 1 - dist(x, y, cx, cy) / (w * 0.62));
        r_ = Math.min(255, r_ + glow * 26);
        g = Math.min(255, g + glow * 20);
        b = Math.min(255, b + glow * 14);
      }

      /* bubble (white, slightly translucent at edges via soft edge) */
      const db = dist(x, y, cx, bubbleCy);
      if (db <= bubbleR && a > 0) {
        const soft = Math.max(0, Math.min(1, (bubbleR - db) / (w * 0.02) + 0.5));
        r_ = lerp(r_, 255, soft); g = lerp(g, 255, soft); b = lerp(b, 255, soft);
        a = Math.max(a, Math.round(255 * soft));
      }
      /* tail */
      if (a > 0) {
        const area = (t1.x - t3.x) * (t2.y - t1.y) - (t1.x - t2.x) * (t3.y - t1.y);
        const s1 = ((t1.x - x) * (t2.y - t1.y) - (t2.x - t1.x) * (t1.y - y)) / area;
        const s2 = ((t2.x - x) * (t3.y - t2.y) - (t3.x - t2.x) * (t2.y - y)) / area;
        const s3 = 1 - s1 - s2;
        if (s1 >= 0 && s2 >= 0 && s3 >= 0) {
          const edge = Math.min(s1, s2, s3);
          const soft = Math.max(0, Math.min(1, edge * (w * 18)));
          r_ = lerp(r_, 255, soft); g = lerp(g, 255, soft); b = lerp(b, 255, soft);
        }
      }
      /* dots */
      for (const dx of dots) {
        const dd = dist(x, y, dx, dotY);
        if (dd <= dotR && a > 0) {
          const soft = Math.max(0, Math.min(1, (dotR - dd) / (w * 0.01) + 0.5));
          r_ = lerp(r_, 99, soft); g = lerp(g, 102, soft); b = lerp(b, 241, soft);
        }
      }

      px[i] = Math.round(r_);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = Math.round(a);
    }
  }
  return encodePNG(w, h, px);
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512, 180]) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, makeIcon(size));
  console.log("wrote", path.relative(process.cwd(), file));
}
