import { describe, expect, it } from "vitest";
import type { Entity } from "../engine/index.ts";
import { freshEntities, initialSession, panelEntities, sessionReducer as reduce } from "./session.ts";

const entity = (placeholder: string, type: Entity["type"] = "NAMN"): Entity => ({
  id: placeholder,
  value: placeholder,
  type,
  placeholder,
  occurrences: [{ start: 0, end: 1, surface: "x" }],
  active: true,
  source: "model",
});

const withText = reduce(initialSession, { type: "setText", text: "Anna" });
const withEntities = reduce(withText, {
  type: "setEntities",
  text: "Anna",
  entities: [entity("[NAMN_1]"), entity("[ORGANISATION_1]", "ORGANISATION")],
});

describe("sessionReducer", () => {
  it("starts empty in Skrubba mode with the model loading", () => {
    expect(initialSession.mode).toBe("scrub");
    expect(initialSession.text).toBe("");
    expect(initialSession.model).toEqual({ status: "loading", pct: 0 });
  });

  it("ignores entities computed for text that has since changed", () => {
    const stale = reduce(withText, { type: "setEntities", text: "Ann", entities: [entity("[NAMN_1]")] });
    expect(stale.entities).toEqual([]);
  });

  it("shows every entity, organisations included, as Skrubba by default", () => {
    expect(panelEntities(withEntities).map((e) => e.active)).toEqual([true, true]);
  });

  it("toggles one entity to Behåll and back", () => {
    const kept = reduce(withEntities, { type: "toggleKeep", placeholder: "[NAMN_1]" });
    expect(panelEntities(kept).map((e) => e.active)).toEqual([false, true]);
    const back = reduce(kept, { type: "toggleKeep", placeholder: "[NAMN_1]" });
    expect(panelEntities(back).map((e) => e.active)).toEqual([true, true]);
  });

  it("keeps the Behåll choice when entities are recomputed", () => {
    const kept = reduce(withEntities, { type: "toggleKeep", placeholder: "[NAMN_1]" });
    const again = reduce(kept, { type: "setEntities", text: "Anna", entities: [entity("[NAMN_1]")] });
    expect(panelEntities(again)[0].active).toBe(false);
  });

  it("sets one entity to Behåll without toggling it back", () => {
    let s = reduce(withEntities, { type: "keep", placeholder: "[NAMN_1]" });
    s = reduce(s, { type: "keep", placeholder: "[NAMN_1]" });
    expect(panelEntities(s)[0].active).toBe(false);
  });

  it("sets all to Behåll and all to Skrubba", () => {
    const allKept = reduce(withEntities, { type: "keepAll" });
    expect(panelEntities(allKept).every((e) => !e.active)).toBe(true);
    expect(panelEntities(reduce(allKept, { type: "scrubAll" })).every((e) => e.active)).toBe(true);
  });

  it("adds a manual term once, trimmed", () => {
    let s = reduce(initialSession, { type: "addManual", term: "  Polaris Air " });
    s = reduce(s, { type: "addManual", term: "polaris air" });
    s = reduce(s, { type: "addManual", term: "   " });
    expect(s.manual).toEqual(["Polaris Air"]);
  });

  it("only offers entities for highlighting when they belong to the current text", () => {
    expect(freshEntities(withEntities)).toHaveLength(2);
    expect(freshEntities(reduce(withEntities, { type: "setText", text: "Anna B" }))).toEqual([]);
  });

  it("loads the example text and its word list", () => {
    const s = reduce(withEntities, { type: "loadExample", text: "Hej", wordList: ["Projekt Havsvind"] });
    expect(s.text).toBe("Hej");
    expect(s.wordListRaw).toBe("Projekt Havsvind");
    expect(s.mode).toBe("scrub");
  });

  it("tracks model state", () => {
    expect(reduce(initialSession, { type: "model", model: { status: "ready" } }).model).toEqual({ status: "ready" });
  });

  it("shows and hides a toast", () => {
    const s = reduce(initialSession, { type: "toast", message: "Kopierat." });
    expect(s.toast).toBe("Kopierat.");
    expect(reduce(s, { type: "toast", message: null }).toast).toBeNull();
  });
});
