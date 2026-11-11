#!/usr/bin/env node
// Stop hook for the fix loop. Active only while .claude/loop/active exists
// (start it with `node .claude/hooks/loop.mjs start`). Each time Claude tries
// to stop, it checks that the exam is untouched and runs the tests and the
// build; if anything fails, the stop is blocked and the failure is fed back.
// Ends on green checks, after MAX rounds, or if the loop file is stale.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const ACTIVE = ".claude/loop/active";
const MAX = Number(process.env.LOOP_MAX_ITERATIONS ?? 20);
const STALE_MS = 6 * 60 * 60 * 1000;
// vite.config.ts decides whether vitest runs the exam, so it is part of it.
const EXAM = ["tests/fuzz", "tests/robustness.test.ts", "vite.config.ts"];
if (!existsSync(ACTIVE)) process.exit(0);

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const state = JSON.parse(readFileSync(ACTIVE, "utf8"));
const done = (message) => {
  rmSync(ACTIVE, { force: true });
  console.log(JSON.stringify({ systemMessage: message }));
  process.exit(0);
};

// A loop left armed by an interrupted run must not trap later sessions.
if (Date.now() - Date.parse(state.started) > STALE_MS) done("Fix loop expired (armed more than 6 hours ago) and was disarmed.");
state.session ??= input.session_id;
if (input.session_id && state.session !== input.session_id) process.exit(0);
state.iteration = (state.iteration ?? 0) + 1;

const block = (what, detail) => {
  if (state.iteration >= MAX) done(`Fix loop stopped after ${MAX} rounds with ${what} still failing. Tell the user what remains.`);
  writeFileSync(ACTIVE, JSON.stringify(state));
  console.log(
    JSON.stringify({
      decision: "block",
      reason: `Round ${state.iteration}/${MAX}: ${what} failed. Fix the cause in src/ (never in ${EXAM.join(" or ")}), then stop again.\n\n${detail}`,
    }),
  );
  process.exit(0);
};

// The real lock: whatever route was taken, the exam must match the commit it was armed at.
try {
  execSync(`git diff --quiet ${state.base} -- ${EXAM.join(" ")}`, { stdio: "pipe" });
  execSync(`git diff --quiet --cached ${state.base} -- ${EXAM.join(" ")}`, { stdio: "pipe" });
} catch {
  block("the exam check", `${EXAM.join(" and ")} differ from ${state.base}. Restore them with \`git checkout ${state.base} -- ${EXAM.join(" ")}\`.`);
}

// REQUIRE_MODEL=1 makes a skipped model test fail. npm test is vitest; npm run build is tsc -b, vite build and the size check.
for (const cmd of ["REQUIRE_MODEL=1 npm test --silent", "npm run build --silent"]) {
  try {
    execSync(cmd, { stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const failed = out.split("\n").filter((l) => /FAIL|×|AssertionError|error/i.test(l)).slice(0, 40).join("\n");
    block(`\`${cmd}\``, failed || out.slice(-4000));
  }
}
done(`Fix loop finished: all checks green after ${state.iteration} round(s).`);
