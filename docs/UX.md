# UX.md – the one screen

No wizard. One page with two operations, one at a time. A switch at the top picks **Skrubba** (make the text safe) or **Avskrubba** (put the real values back in the AI's answer). The input is on the left, the button between the panes runs the operation, the result appears on the right, and only then does "Kopiera" show up under it. The kodnyckel and Vanliga frågor open as windows on top. Owner's redesign, 2026-10-10.

```
                          Skrubba                          ← logotype
                  ( Skrubba | Avskrubba )                  ← mode switch
             Vanliga frågor | Så här funkar det            ← help links
 Din text            Visa exempel        Skrubbad text
 ┌────────────────────────────┐          ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
 │ text, highlights overlaid  │          │ [NAMN_1] ringde …         │
 │ click a highlight to keep  │ [Skrubba →] (read-only)             │
 │                            │  Ny text │                           │
 └────────────────────────────┘          └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
 ●●●● 13 uppgifter  Visa ›          ●●●● Kodnyckel · 13 platshållare  Visa ›  [Kopiera]
 Skrubba hittar inte allt …
 ▸ Egna ord (1)
 ─────────────────────────────────────────────────────────────────
   Bygger på maskera (MIT) … Öppen källkod från Prompt Agency.
                     Inget lämnar din dator
```

In Avskrubba the left pane is "Svar från AI", the button says "Avskrubba →" and the right pane is "Avskrubbad text", with any "Menade du …?" questions under it.

The kodnyckel is not on screen all the time: Avskrubba uses it by itself within the tab. It shows up where it is needed. The strip "Kodnyckel · 13 platshållare  Visa ›" sits beside Kopiera once the tab has one (in both modes, and also after the result is cleared, so it can still be downloaded). In Avskrubba, a tab without one shows `key.missing` and "Ladda upp kodnyckel" under "Svar från AI"; uploading keeps the pasted answer.

History of texts (in the wireframe) is left out for now: text may only live in memory, and saved cases are out of scope for v1.

## Skrubba

**Input.** Paste or type. Processing starts on paste immediately and on typing after 300 ms idle.

**Model first.** The editor is locked until the model is ready, so nobody reviews a list that is missing every name. The locked editor shows the loading state in place, not a modal: `gate.lead`, `gate.body` and the progress line "Laddar modell 43 %". When the model is ready the editor unlocks and takes focus. If the model fails, the editor unlocks in rules-only mode with `status.rulesOnly` under the card. After the first visit the model comes from the browser's cache and the offline cache, so the lock lasts a second or two.

**Detection order.** Word list and rules first (instant), then NER. When NER finishes, new highlights appear without moving the caret.

**Highlights.** Overlay behind a transparent textarea so editing keeps working. Each type has a colour **and** a label on hover. Never colour alone.

**Summary strips.** "13 uppgifter" and the kodnyckel are strips, not plain links, so it is clear they open something: a dot per kind found (in the type's strong colour, fixed order Namn, Plats, Organisation, Nummer, Ord), the count, and "Visa ›" in the brand colour. They sit on `yta`, without a border until hover. Not on `lodder`: some strong colours drop under 3:1 there. Owner's change, 2026-10-11.

**Uppgifter window.** The items found are not listed on the page. "13 uppgifter" under the left pane is a summary strip that opens them in a window over the page, like the kodnyckel: title "Uppgifter", "Stäng", Esc closes. One row per unique value (merged across casing and genitive, "Anna" / "Annas"). Columns: toggle dot, value, type, count. The button on each row names what it does: "Behåll uppgift" on an item being scrubbed, "Skrubba uppgift" on a kept one (owner's change, 2026-10-11; it used to show the state, which read as the opposite). The dot (● / ○) shows the state. "Skrubba alla" and "Behåll alla" sit under the rows. Clicking a row closes the window, scrolls to the first occurrence and flashes all. Organisations are on by default. Word-list and manual entries show type "Ord". Owner's change, 2026-10-11.

**Manual masking.** Select text → press `M` or the floating "Skrubba markering" button. All occurrences of the selection become one `ORD` entity. Selecting inside a highlight and pressing `B` toggles it to Behåll.

**Clicking in the text.** A plain click on a highlight switches it between Skrubba (filled with the type colour) and Behåll (a border in a darker shade of the type colour, the same as its dot in the list, 1px off the text), for every occurrence. The pointer turns into a hand over highlights. A drag that selects text, a click with Shift/Cmd/Ctrl/Alt, or a double-click (which selects the word) does not switch anything. Trade-off: placing the caret inside a highlight with a single click also switches it; click again to switch back.

**Egna ord.** Folded section under the left pane, not in the Uppgifter window, so terms can be added before there is text. It stays folded when the example loads. One term per line. Placeholder text: "Kundnamn, projektnamn, produkter …". Edits re-run matching live. The list is part of the key and is saved with it.

**Skrubba and Kopiera.** The button between the panes masks the current text afresh, shows the result in "Skrubbad text" (placeholders highlighted in their type colour) and records the kodnyckel. Focus moves to "Kopiera", which appears under the result and copies it. Toast: "Kopierat. 14 uppgifter skrubbade." Any change that alters what would be scrubbed (editing the text, a click on a highlight, the list, Egna ord, the example) clears the result and hides "Kopiera", so nothing stale is copied; press Skrubba again.

**Ny text.** A quiet link under the button between the panes, shown once the left pane has text. In Skrubba it starts over: text, choices (kept items, words marked by selection), result, AI answer and kodnyckel are cleared, and numbering starts again at `_1`, so one key never mixes unrelated texts and a downloaded key holds only one case. Egna ord stay, since they are the user's standing list. If the key has entries it asks first (`action.newTextConfirm`, a browser confirm like Rensa allt). In Avskrubba it only empties the answer and its result, so the next answer from the same chat restores with the same key. Visa exempel and pasting over the text do not reset the key. Focus goes to the emptied pane. "Rensa allt" in the kodnyckel window still wipes everything, Egna ord included. Owner's addition, 2026-10-11; the new key on Ny text was decided the same day, after the owner found the key growing across unrelated texts.

**Wrong mode.** Text with exact placeholders like `[NAMN_1]` in Skrubba is probably the AI's answer. A notice says so (`wrongMode.notice`) with a button "Flytta till Avskrubba" that moves the text over and switches mode. Nothing switches by itself.

**Empty state.** "Klistra in text här. Den stannar i din webbläsare." plus "Visa exempel". The item count stays hidden until there is text; "Egna ord" is always there so terms can be added first.

## Avskrubba

"Svar från AI" takes the AI's answer, usable while the model loads; its placeholders are highlighted. The button between the panes puts the real values back in "Avskrubbad text" on the right, restored values highlighted in their type colour, and "Kopiera" appears under it. The answer on the left stays as pasted. Editing it clears the result.

Unmatched placeholders are listed under the result:

> Hittade `Namn 1` i svaret. Menade du `[NAMN_1]`, alltså Anna Berg?  [Ja] [Nej]

Tolerant matching rules live in `docs/ARCHITECTURE.md`. The tool asks when unsure; it never silently substitutes.

## Kodnyckel window

"Kodnyckel" is the established Swedish word for a list linking codes to real identities; it is not an encryption key, and the explainer (`key.explainer`) at the top of the window says so by example. Opened from the kodnyckel strip beside Kopiera. A window over the page: title "Kodnyckel", "Stäng", Esc closes. Table: Platshållare · Värde · Typ · Förekomster. Below it, the word list. Buttons:

- "Ladda ner kodnyckel" → `skrubba-kodnyckel-YYYY-MM-DD.json` (entities + word list). Line under: "Filen innehåller riktiga uppgifter. Spara den där du sparar känsligt material."
- "Ladda upp kodnyckel" → file picker, restores key and word list into memory.
- "Rensa allt" → clears text, entities, word list, key. Confirmation required.

Note under the table: "Kodnyckeln finns bara i den här fliken. Stänger du fliken försvinner den."

## Så här funkar det window

"Så här funkar det", after "Vanliga frågor" behind a thin vertical line, opens a window with a 51 second video of the whole round trip with the example text, captioned in Swedish (`HOWTO` in `docs/COPY.md`). No sound. The steps are also in the window as hidden text for screen readers. The video loads only when the window opens and stops when it closes; the offline cache leaves it out, so it needs a connection. Re-record it after visible changes with `npm run demo-video` (needs ffmpeg and `npm run preview`). Both links sit centred under the switch at every width (owner's change, 2026-10-11); the captions sit well above the bottom edge so the video controls do not cover them. Owner's addition, 2026-10-11.

## Vanliga frågor window

The link "Vanliga frågor" under the mode switch, and "Inget lämnar din dator" in the footer, open a window over the page with four questions and answers (`docs/COPY.md`, Vanliga frågor). The text and the session stay as they were behind it.

## Model state

Loading progress shows in Skrubba's left pane (`gate.lead`, `gate.body`, "Laddar modell 43 %"). Avskrubba and the kodnyckel work while the model loads. Screen readers hear the state through a hidden live region, loading only in quarters. "Inget lämnar din dator" sits in the footer and opens Vanliga frågor.

## Dropping files

The left pane in either mode accepts a dropped `.txt` or `.md` file, read in the browser. Anything else gets `drop.unsupported` and leaves the pane as it was. Word and PDF are out of scope for v1.

## Keyboard

| Key | Action |
|---|---|
| `M` (with selection) | Skrubba selection |
| `B` (with selection or focused row) | Behåll |
| `Cmd/Ctrl+Enter` | Run the current mode (the button between the panes) |
| `Cmd/Ctrl+Shift+C` | Kopiera the result, running the mode first if there is none |
| `↑ ↓` in the Uppgifter window, `Space` | Navigate rows, toggle |
| `Esc` | Close the Uppgifter, kodnyckel, Vanliga frågor or Så här funkar det window, or the toast |

## Mobile (≥ 390 px)

The mode switch spans the width. Input, button (arrow pointing down) and result stack; the item count and Egna ord stay under the input. The windows fit the screen width. Nothing scrolls sideways.

## What this screen must never do

- Show a modal on load. (The windows open only when asked for.)
- Ask for an account, email or cookie consent (there are no cookies).
- Send anything anywhere. Vanliga frågor says exactly how to verify that.
