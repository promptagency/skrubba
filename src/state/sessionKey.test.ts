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

  it("replaces the whole session with an uploaded key, except the AI answer waiting for it", () => {
    let s = reduce(initialSession, { type: "setText", text: "Anna" });
    s = reduce(s, { type: "setAnswer", text: "Hej [NAMN_2]" });
    s = reduce(s, { type: "addManual", term: "Anna" });
    s = reduce(s, { type: "model", model: { status: "ready" } });
    const key: Key = { entries: [erik], wordList: ["Havsvind"], createdAt: now, app: "skrubba", version: 1 };
    s = reduce(s, { type: "loadKey", key });
    expect(s.text).toBe("");
    expect(s.answer).toBe("Hej [NAMN_2]");
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

describe("Ny text", () => {
  const scrubbedSession = () => {
    let s = reduce(initialSession, { type: "setWordList", raw: "Havsvind" });
    s = reduce(s, { type: "setText", text: "Anna" });
    s = reduce(s, { type: "addManual", term: "Anna" });
    s = reduce(s, { type: "toggleKeep", placeholder: "[NAMN_1]" });
    s = reduce(s, { type: "scrubbed", masked: "[NAMN_1]", entries: [anna], at: now });
    s = reduce(s, { type: "setAnswer", text: "Hej [NAMN_1]" });
    return reduce(s, { type: "model", model: { status: "ready" } });
  };

  it("in Skrubba starts over with a new kodnyckel and keeps only Egna ord", () => {
    const s = reduce(scrubbedSession(), { type: "newText", mode: "scrub" });
    expect(s.text).toBe("");
    expect(s.scrubbed).toBeNull();
    expect(s.entities).toEqual([]);
    expect(s.manual).toEqual([]);
    expect(s.kept.size).toBe(0);
    expect(s.keyEntries).toEqual([]);
    expect(s.keyCreatedAt).toBeNull();
    expect(s.keyDownloaded).toBe(true);
    // The answer belongs to the old key, which is gone.
    expect(s.answer).toBe("");
    expect(s.wordListRaw).toBe("Havsvind");
    expect(s.model).toEqual({ status: "ready" });
  });

  it("in Avskrubba clears the answer and its result, and keeps everything else", () => {
    let s = reduce(scrubbedSession(), { type: "restored", result: { text: "Hej Anna", restored: [], unknown: [], suggestions: [] } });
    const before = s;
    s = reduce(s, { type: "newText", mode: "restore" });
    expect(s.answer).toBe("");
    expect(s.restore).toBeNull();
    expect(s.text).toBe(before.text);
    expect(s.manual).toEqual(before.manual);
    expect(s.keyEntries).toEqual([anna]);
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
