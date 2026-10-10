import { describe, expect, it } from "vitest";
import { announcement } from "./StatusBar.tsx";

describe("announcement", () => {
  it("speaks loading progress in quarters only", () => {
    expect(announcement({ status: "loading", pct: 0 })).toBe("Laddar modell 0 %");
    expect(announcement({ status: "loading", pct: 24 })).toBe("Laddar modell 0 %");
    expect(announcement({ status: "loading", pct: 51 })).toBe("Laddar modell 50 %");
  });

  it("speaks ready and rules-only in full", () => {
    expect(announcement({ status: "ready" })).toBe("Modell laddad");
    expect(announcement({ status: "rulesOnly" })).toMatch(/^Modellen kunde inte laddas\./);
  });
});
