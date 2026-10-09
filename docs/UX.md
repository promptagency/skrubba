# UX.md – the one screen

No wizard. One screen, three modes, switchable at any time. State is shared across modes.

```
┌──────────────────────────────────────────────────────────────┐
│ [Skrubba]  [Byt tillbaka]  [Nyckel]          Visa exempel  ? │
├────────────────────────────────────┬─────────────────────────┤
│                                    │ 14 uppgifter            │
│  Textyta                           │ ─────────────────────── │
│  (editable, highlights overlaid)   │ ● Anna Berg      Namn ×3│
│                                    │ ● 850412-1234    Pnr ×1 │
│                                    │ ● Floda          Plats×2│
│                                    │ ● Ikea           Org  ×1│
│                                    │ ○ Göteborg       Plats×1│  ← behåll
│                                    │ ● Projekt Nordlys Ord ×2│  ← egna ord
│                                    │ ─────────────────────── │
│                                    │ ▸ Egna ord (1)          │
│                                    │ [Skrubba alla] [Behåll alla]
├────────────────────────────────────┴─────────────────────────┤
│ ● Modell laddad · Inget lämnar din dator          [Kopiera]  │
└──────────────────────────────────────────────────────────────┘
```

## Mode: Skrubba

**Input.** Paste or type. Processing starts on paste immediately and on typing after 300 ms idle.

**Detection order.** Word list and rules first (instant), then NER when the model is ready. While loading, status bar shows "Laddar modell … 43 %" and rule hits are already highlighted. When NER finishes, new highlights appear without moving the caret.

**Highlights.** Overlay behind a transparent textarea so editing keeps working. Each type has a colour **and** a label on hover. Never colour alone.

**Entity panel.** One row per unique value (merged across casing and genitive, "Anna" / "Annas"). Columns: toggle dot, value, type, count. Toggle = Skrubba / Behåll. Clicking a row scrolls to the first occurrence and flashes all. Organisations are on by default. Word-list and manual entries show type "Ord".

**Manual masking.** Select text → press `M` or the floating "Skrubba markering" button. All occurrences of the selection become one `ORD` entity. Selecting inside a highlight and pressing `B` toggles it to Behåll.

**Egna ord.** Collapsible section under the list. One term per line. Placeholder text: "Kundnamn, projektnamn, produkter …". Edits re-run matching live. The list is part of the key and is saved with it.

**Copy.** "Kopiera" copies the text with all active entities replaced. Toast: "Kopierat. 14 uppgifter skrubbade." Counter updates live.

**Empty state.** "Klistra in text här. Den stannar i din webbläsare." plus "Visa exempel".

## Mode: Byt tillbaka

Textarea for the LLM answer. Button "Byt tillbaka" (also `Cmd/Ctrl+Enter`). Result replaces the content, restored values highlighted.

Unmatched placeholders are listed under the text:

> Hittade `Namn 1` i svaret. Menade du `[NAMN_1]`, alltså Anna Berg?  [Ja] [Nej]

Tolerant matching rules live in `docs/ARCHITECTURE.md`. The tool asks when unsure; it never silently substitutes.

"Kopiera" at the bottom.

## Mode: Nyckel

Table: Platshållare · Värde · Typ · Förekomster. Below it, the word list. Buttons:

- "Ladda ner nyckel" → `skrubba-nyckel-YYYY-MM-DD.json` (entities + word list). Line under: "Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material."
- "Ladda upp nyckel" → file picker, restores key and word list into memory.
- "Rensa allt" → clears text, entities, word list, key. Confirmation required.

Note under the table: "Nyckeln finns bara i den här fliken. Stänger du fliken försvinner den."

## Status bar (always visible)

Left: model state (● Laddar modell 43 % / ● Modell laddad / ● Endast regler) and "Inget lämnar din dator" linking to `/sa-funkar-det`.
Right: primary action for the current mode.

## Keyboard

| Key | Action |
|---|---|
| `Cmd/Ctrl+1 / 2 / 3` | Switch mode |
| `M` (with selection) | Skrubba selection |
| `B` (with selection or focused row) | Behåll |
| `Cmd/Ctrl+Shift+C` | Copy |
| `Cmd/Ctrl+Enter` | Primary action in current mode |
| `↑ ↓` in panel, `Space` | Navigate rows, toggle |
| `Esc` | Close toast / dialog |

## Mobile (≥ 390 px)

Textarea full width. Entity panel becomes a bottom sheet opened by the chip "14 uppgifter". Mode switch stays at top. Primary action sticky at bottom.

## What this screen must never do

- Show a modal on load.
- Ask for an account, email or cookie consent (there are no cookies).
- Send anything anywhere. The "?" page says exactly how to verify that.
