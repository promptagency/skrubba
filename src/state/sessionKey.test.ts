import { describe, expect, it } from "vitest";
import type { Key, RestoreResult } from "../engine/index.ts";
import { currentKey, initialSession, sessionReducer as reduce } from "./session.ts";

const anna = { placeholder: "[NAMN_1]", value: "Anna", type: "NAMN" as const };
const erik = { placeholder: "[NAMN_2]", value: "Erik", type: "NAMN" as const };
const now = "2026-10-10T08:00:00.000Z";

describe("key in the session", () => {
  it("has no key before the first Skrubba", () => {
    expect(initialSession.keyEntries).toEqual([]);
    expect(initialSession.keyDownloaded).toBe(true);
  });

  it("builds the key up from every Skrubba and marks it not downloaded", () => {
    let s = reduce(initialSession, { type: "scrubbed", masked: "x", entries: [anna], at: now });
    s = reduce(s, { type: "scrubbed", masked: "x", entries: [anna, erik], at: "2026-10-10T09:00:00.000Z" });
    expect(s.keyEntries).toEqual([anna, erik]);
    expect(s.keyDownloaded).toBe(false);
    expect(s.keyCreatedAt).toBe(now);
  });

  it("stays downloaded when a Skrubba adds nothing new", () => {
    let s = reduce(initialSession, { type: "scrubbed", masked: "x", entries: [anna], at: now });
    s = reduce(s, { type: "keyDownloaded" });
    s = reduce(s, { type: "scrubbed", masked: "x", entries: [anna], at: now });
    expect(s.keyDownloaded).toBe(true);
  });

  it("builds a downloadable key with the word list", () => {
    let s = reduce(initialSession, { type: "setWordList", raw: "Havsvind\n\nNordljus" });
    s = reduce(s, { type: "scrubbed", masked: "x", entries: [anna], at: now });
    expect(currentKey(s)).toEqual({ entries: [anna], wordList: ["Havsvind", "Nordljus"], createdAt: now, app: "skrubba", version: 1 });
  });

  it("replaces the whole session with an uploaded key", () => {
    let s = reduce(initialSession, { type: "setText", text: "Anna" });
    s = reduce(s, { type: "addManual", term: "Anna" });
    s = reduce(s, { type: "model", model: { status: "ready" } });
    const key: Key = { entries: [erik], wordList: ["Havsvind"], createdAt: now, app: "skrubba", version: 1 };
    s = reduce(s, { type: "loadKey", key });
    expect(s.text).toBe("");
    expect(s.manual).toEqual([]);
    expect(s.keyEntries).toEqual([erik]);
    expect(s.wordListRaw).toBe("Havsvind");
    expect(s.keyDownloaded).toBe(true);
    expect(s.model).toEqual({ status: "ready" });
  });

  it("clears everything except the loaded model", () => {
    let s = reduce(initialSession, { type: "setText", text: "Anna" });
    s = reduce(s, { type: "scrubbed", masked: "x", entries: [anna], at: now });
    s = reduce(s, { type: "model", model: { status: "ready" } });
    s = reduce(s, { type: "clearAll" });
    expect(s).toEqual({ ...initialSession, model: { status: "ready" } });
  });
});

describe("Avskrubba in the session", () => {
  const result: RestoreResult = { text: "Hej Anna", restored: [{ start: 4, end: 8, placeholder: "[NAMN_1]", value: "Anna" }], suggestions: [], unknown: [] };

  it("keeps the answer as pasted and holds the result beside it", () => {
    let s = reduce(initialSession, { type: "setAnswer", text: "Hej [NAMN_1]" });
    s = reduce(s, { type: "restored", result });
    expect(s.answer).toBe("Hej [NAMN_1]");
    expect(s.restore?.result.text).toBe("Hej Anna");
  });

  it("drops the result when the answer is edited", () => {
    let s = reduce(initialSession, { type: "setAnswer", text: "Hej [NAMN_1]" });
    s = reduce(s, { type: "restored", result });
    s = reduce(s, { type: "setAnswer", text: "Hej [NAMN_1]!" });
    expect(s.restore).toBeNull();
  });

  it("remembers accepted and rejected suggestions across re-runs for the same answer", () => {
    let s = reduce(initialSession, { type: "setAnswer", text: "Hej NAMN 1" });
    s = reduce(s, { type: "restored", result });
    s = reduce(s, { type: "suggestion", found: "NAMN 1", accept: false });
    expect(s.restore?.rejected).toEqual(["NAMN 1"]);
    s = reduce(s, { type: "suggestion", found: "NAME_1", accept: true });
    s = reduce(s, { type: "restored", result });
    expect(s.restore?.accepted).toEqual(["NAME_1"]);
    expect(s.restore?.rejected).toEqual(["NAMN 1"]);
  });
});
