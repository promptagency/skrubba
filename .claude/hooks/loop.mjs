#!/usr/bin/env node
// node .claude/hooks/loop.mjs start | stop | status
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const ACTIVE = ".claude/loop/active";
const cmd = process.argv[2];
if (cmd === "start") {
  mkdirSync(".claude/loop", { recursive: true });
  writeFileSync(ACTIVE, JSON.stringify({ iteration: 0, started: new Date().toISOString(), base: execSync("git rev-parse HEAD").toString().trim() }));
  console.log("Loop armed at the current commit; commit any exam changes before arming. Ask Claude to fix the failing robustness cases; it can't stop until checks are green.");
} else if (cmd === "stop") {
  rmSync(ACTIVE, { force: true });
  console.log("Loop disarmed.");
} else {
  console.log(existsSync(ACTIVE) ? `Active: ${readFileSync(ACTIVE, "utf8")}` : "Not active.");
}
