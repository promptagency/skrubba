# UX.md – the one screen

No wizard. One page, two cards side by side: **Skrubba** (make the text safe) and **Avskrubba** (put the real values back in the AI's answer). The key opens as a card on top. Layout from the owner's wireframe, 2026-10-10.

```
                          Skrubba                          ← logotype
 Nyckel [ 13 uppgifter ]                               (?)
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

**Empty state.** "Klistra in text här. Den stannar i din webbläsare." plus "Visa exempel".

## Avskrubba card

Textarea for the AI's answer, usable while the model loads. The button under the card says "Avskrubba" (also `Cmd/Ctrl+Enter` in the card); the result replaces the content with restored values highlighted, and the same button becomes "Kopiera". Editing the answer turns it back into "Avskrubba".

Unmatched placeholders are listed under the text:

> Hittade `Namn 1` i svaret. Menade du `[NAMN_1]`, alltså Anna Berg?  [Ja] [Nej]

Tolerant matching rules live in `docs/ARCHITECTURE.md`. The tool asks when unsure; it never silently substitutes.

## Key card

Opened from the key button next to "Nyckel" (it reads "Ingen nyckel än", then "{n} uppgifter"). A dialog over the page: title "Nyckel", "Stäng", Esc closes. Table: Platshållare · Värde · Typ · Förekomster. Below it, the word list. Buttons:

- "Ladda ner nyckel" → `skrubba-nyckel-YYYY-MM-DD.json` (entities + word list). Line under: "Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material."
- "Ladda upp nyckel" → file picker, restores key and word list into memory.
- "Rensa allt" → clears text, entities, word list, key. Confirmation required.

Note under the table: "Nyckeln finns bara i den här fliken. Stänger du fliken försvinner den."

## Model state

Loading progress shows inside the Skrubba card (`gate.lead`, `gate.body`, "Laddar modell 43 %"). The Avskrubba card and the key card work while the model loads. Screen readers hear the state through a hidden live region, loading only in quarters. "Inget lämnar din dator" sits in the footer and links to `/sa-funkar-det`; "?" top right links there too.

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
| `Esc` | Close the key card or the toast |

## Mobile (≥ 390 px)

The cards stack, Skrubba first; the item list stays under the Skrubba card and folds with its toggle. The key card fits the screen width. Nothing scrolls sideways.

## What this screen must never do

- Show a modal on load. (The key card opens only when asked for.)
- Ask for an account, email or cookie consent (there are no cookies).
- Send anything anywhere. The "?" page says exactly how to verify that.
