/* Tiny static file server for trying the app on a phone over Wi-Fi.
   `npm run serve` then open the printed LAN address on the phone.
   No dependencies — this is only a convenience; the app itself still
   works by double-clicking index.html. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "..", "public");
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
  // Refuse anything that escapes public/.
  if (!file.startsWith(ROOT + path.sep)){
    res.writeHead(403); return res.end("forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
  console.log(`Serving ${ROOT}`);
  console.log(`  local:  http://localhost:${PORT}`);
  for (const ip of lan) console.log(`  phone:  http://${ip}:${PORT}`);
});
