// Rules of our own, shaped like a maskera Detector so they run in the same
// pipeline (and the worker clips model spans against them too).

interface ContextDetector {
  readonly label: "ORGANISATIONSNUMMER";
  detect(input: string): Array<{ start: number; end: number; value: string }>;
}

// maskera only masks Luhn-valid org.nr. A labelled number is masked even with
// a typo in the check digit: a miss is worse than an over-mask.
const ORGNR_LABELLED = /(?:org\.?\s?nr\.?|organisationsnummer)\s*:?\s*(\d{6}-?\d{4})(?!\d)/giu;

export const orgnrInContext: ContextDetector = {
  label: "ORGANISATIONSNUMMER",
  detect(input) {
    const out: Array<{ start: number; end: number; value: string }> = [];
    for (const m of input.matchAll(ORGNR_LABELLED)) {
      const value = m[1];
      const start = m.index + m[0].length - value.length;
      out.push({ start, end: start + value.length, value });
    }
    return out;
  },
};
