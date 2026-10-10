# UX.md – the one screen

No wizard. One page, two cards side by side: **Skrubba** (make the text safe) and **Avskrubba** (put the real values back in the AI's answer). The kodnyckel and Vanliga frågor open as windows on top. Layout from the owner's wireframe, 2026-10-10.

```
                          Skrubba                          ← logotype
 Kodnyckel [ 13 uppgifter ]                    [Vanliga frågor]
   Visar vilka riktiga uppgifter platshållarna står för …
 Skrubba            Visa exempel   Avskrubba
 ┌──────────────────────────────┐  ┌──────────────────────────────┐
 │ text, highlights overlaid    │  │ the AI's answer; restored    │
 │ (paste, type or drop .txt/.md)│  │ values highlighted           │
 └──────────────────────────────┘  └──────────────────────────────┘
 13 uppgifter ▾        [Kopiera]   Hittade NAMN 1 … ? [Ja] [Nej]
 Skrubba hittar inte allt …                          [Avskrubba]
 ● Anna Berg    Namn  ×3 Skrubba
 ○ Göteborg     Plats ×1 Behåll
 ▸ Egna ord (1)
 [Skrubba alla] [Behåll alla]
 ─────────────────────────────────────────────────────────────────
   Bygger på maskera (MIT) … Öppen källkod från Prompt Agency.
                     Inget lämnar din dator
```

History of texts (in the wireframe) is left out for now: text may only live in memory, and saved cases are out of scope for v1.

## Skrubba card

**Input.** Paste or type. Processing starts on paste immediately and on typing after 300 ms idle.

**Model first.** The editor is locked until the model is ready, so nobody reviews a list that is missing every name. The locked editor shows the loading state in place, not a modal: `gate.lead`, `gate.body` and the progress line "Laddar modell 43 %". When the model is ready the editor unlocks and takes focus. If the model fails, the editor unlocks in rules-only mode with `status.rulesOnly` under the card. After the first visit the model comes from the browser's cache and the offline cache, so the lock lasts a second or two.

**Detection order.** Word list and rules first (instant), then NER. When NER finishes, new highlights appear without moving the caret.

**Highlights.** Overlay behind a transparent textarea so editing keeps working. Each type has a colour **and** a label on hover. Never colour alone.

**Entity panel.** One row per unique value (merged across casing and genitive, "Anna" / "Annas"). Columns: toggle dot, value, type, count. Toggle = Skrubba / Behåll. Clicking a row scrolls to the first occurrence and flashes all. Organisations are on by default. Word-list and manual entries show type "Ord".

**Manual masking.** Select text → press `M` or the floating "Skrubba markering" button. All occurrences of the selection become one `ORD` entity. Selecting inside a highlight and pressing `B` toggles it to Behåll.

**Egna ord.** Collapsible section under the list. One term per line. Placeholder text: "Kundnamn, projektnamn, produkter …". Edits re-run matching live. The list is part of the key and is saved with it.

**Copy.** "Kopiera" copies the text with all active entities replaced. Toast: "Kopierat. 14 uppgifter skrubbade." Counter updates live.

**Empty state.** "Klistra in text här. Den stannar i din webbläsare." plus "Visa exempel". The item count and "Skrubba alla" / "Behåll alla" stay hidden until there is text; "Egna ord" is always there so terms can be added first.

## Avskrubba card

Textarea for the AI's answer, usable while the model loads. The button under the card says "Avskrubba" (also `Cmd/Ctrl+Enter` in the card); the result replaces the content with restored values highlighted, and the same button becomes "Kopiera". Editing the answer turns it back into "Avskrubba".

Unmatched placeholders are listed under the text:

> Hittade `Namn 1` i svaret. Menade du `[NAMN_1]`, alltså Anna Berg?  [Ja] [Nej]

Tolerant matching rules live in `docs/ARCHITECTURE.md`. The tool asks when unsure; it never silently substitutes.

## Kodnyckel window

"Kodnyckel" is the established Swedish word for a list linking codes to real identities; it is not an encryption key, and the explainer (`key.explainer`) next to the button and at the top of the window says so by example. Opened from the button next to "Kodnyckel" (it reads "Ingen kodnyckel än", then "{n} uppgifter"). A window over the page: title "Kodnyckel", "Stäng", Esc closes. Table: Platshållare · Värde · Typ · Förekomster. Below it, the word list. Buttons:

- "Ladda ner kodnyckel" → `skrubba-kodnyckel-YYYY-MM-DD.json` (entities + word list). Line under: "Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material."
- "Ladda upp kodnyckel" → file picker, restores key and word list into memory.
- "Rensa allt" → clears text, entities, word list, key. Confirmation required.

Note under the table: "Kodnyckeln finns bara i den här fliken. Stänger du fliken försvinner den."

## Vanliga frågor window

The button "Vanliga frågor" top right, and "Inget lämnar din dator" in the footer, open a window over the page with four questions and answers (`docs/COPY.md`, Vanliga frågor). The text and the session stay as they were behind it.

## Model state

Loading progress shows inside the Skrubba card (`gate.lead`, `gate.body`, "Laddar modell 43 %"). The Avskrubba card and the key card work while the model loads. Screen readers hear the state through a hidden live region, loading only in quarters. "Inget lämnar din dator" sits in the footer and opens Vanliga frågor.

## Dropping files

Each card accepts a dropped `.txt` or `.md` file, read in the browser. Anything else gets `drop.unsupported` and leaves the card as it was. Word and PDF are out of scope for v1.

## Keyboard

| Key | Action |
|---|---|
| `M` (with selection) | Skrubba selection |
| `B` (with selection or focused row) | Behåll |
| `Cmd/Ctrl+Shift+C` | Copy from the card in focus (Skrubba otherwise) |
| `Cmd/Ctrl+Enter` | Skrubba card: Kopiera. Avskrubba card: Avskrubba, then Kopiera |
| `↑ ↓` in the list, `Space` | Navigate rows, toggle |
| `Esc` | Close the kodnyckel or Vanliga frågor window, or the toast |

## Mobile (≥ 390 px)

The cards stack, Skrubba first; the item list stays under the Skrubba card and folds with its toggle. The windows fit the screen width. Nothing scrolls sideways.

## What this screen must never do

- Show a modal on load. (The windows open only when asked for.)
- Ask for an account, email or cookie consent (there are no cookies).
- Send anything anywhere. Vanliga frågor says exactly how to verify that.
