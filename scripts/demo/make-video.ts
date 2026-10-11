// Record the walkthrough and write public/video/skrubba-demo.mp4 and its poster.
// Needs ffmpeg and a preview server on port 4173: npm run build && npm run preview.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const out = ".cache/demo";
rmSync(out, { recursive: true, force: true });
execFileSync("npx", ["playwright", "test", "--config", "scripts/demo/playwright.config.ts"], { stdio: "inherit" });

const dir = join(out, readdirSync(out).find((d) => d.startsWith("walkthrough"))!);
// The video starts with the page; cut the model loading off the front.
const start = Number(readFileSync(join(dir, "ready-at.txt"), "utf8")) + 0.4;
const ffmpeg = (...args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
ffmpeg("-ss", String(start), "-i", join(dir, "video.webm"), "-c:v", "libx264", "-crf", "20", "-preset", "slow",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", "public/video/skrubba-demo.mp4");
ffmpeg("-ss", "4", "-i", "public/video/skrubba-demo.mp4", "-frames:v", "1", "-q:v", "4", "public/video/skrubba-demo.jpg");
console.log("public/video/skrubba-demo.mp4 written");
