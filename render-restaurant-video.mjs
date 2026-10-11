import http from "node:http";
import path from "node:path";
import { existsSync, createReadStream } from "node:fs";
import { make } from "./app/lib/render.mjs";
import { readJson } from "./app/lib/store.mjs";
import { BASE, DATA, MUSIC, OUTPUT, PORT, PROJECTS, ROOT, UI } from "./app/lib/paths.mjs";

console.log("=== Zaiqa Lounge & Grill Video Renderer ===");

// 1. Ensure static asset server is responding on port 4545
let isServerRunning = false;
try {
  const check = await fetch("http://localhost:4545/api/state");
  if (check.ok) isServerRunning = true;
} catch {
  isServerRunning = false;
}

if (!isServerRunning) {
  console.log("Starting internal asset server on port 4545...");
  const serveFile = (req, res, root, rel) => {
    const file = path.resolve(root, rel);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const types = { ".png": "image/png", ".jpg": "image/jpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".json": "application/json" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    createReadStream(file).pipe(res);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, BASE);
    if (url.pathname.startsWith("/files/projects/")) return serveFile(req, res, PROJECTS, url.pathname.slice(16));
    if (url.pathname.startsWith("/files/music/")) return serveFile(req, res, MUSIC, url.pathname.slice(13));
    if (url.pathname.startsWith("/files/output/")) return serveFile(req, res, OUTPUT, url.pathname.slice(14));
    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log("Asset server running on port 4545");
  });
} else {
  console.log("Asset server already active on port 4545");
}

// 2. Load the restaurant brief
const brief = await readJson("./data/projects/localhost/brief.json");
console.log(`Loaded brief for: ${brief.name}`);
console.log(`Pages photographed: ${brief.pages.length}`);
console.log(`Features: ${brief.features.join(", ")}`);

// 3. Render the short launch video reel (1080x1920)
console.log("\nStarting Remotion video render...");
const startTime = Date.now();

let lastPct = -1;
const result = await make(
  {
    brief,
    kind: "short",
    shape: "story",
  },
  (step) => console.log(`[STEP] ${step}`),
  (progress, p) => {
    const pct = Math.floor(progress * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      const f = p?.renderedFrames !== undefined ? ` (frame ${p.renderedFrames})` : "";
      console.log(`[RENDER PROGRESS] ${pct}%${f}`);
    }
  }
);

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n=== VIDEO RENDER COMPLETE in ${elapsed}s ===`);
console.log("Result:", JSON.stringify(result, null, 2));
console.log(`Output file: ${path.join(OUTPUT, brief.slug, result.file)}`);
process.exit(0);
