# Skrubba design programme

Skrubba masks personal data in Swedish text before it is pasted into an AI service, and restores it with a key. The look comes from the cleaning cupboard, not from the security industry. It should feel warm, sturdy and easy to trust.

This folder is the source of truth for how the app looks. Read this file before any change to the interface.

## What is in this folder

| Path | What it is | How to use it |
|---|---|---|
| `tokens.css` | All colours, fonts, spacing and radii as CSS custom properties, for both themes | Import it. Every visual value in the app comes from here |
| `fonts.css`, `fonts/` | The three typefaces as self-hosted variable fonts, with their licences | Import it. Never load fonts from a CDN |
| `logo/` | Logotype and symbol as SVG | Use the files as they are |
| `reference/` | Styles, markup and screenshots of example components | Look, do not import. See "Reference material" below |
| `MIGRATION.md` | The first task: moving the app onto the tokens | Follow once |

## Vocabulary

Token names are Swedish and belong to the brand. Keep them as they are.

| Token | Meaning |
|---|---|
| `grund` | ground, the page background |
| `yta` | surface, raised on the ground |
| `yta-sankt` | sunken surface |
| `text-dampad` | muted text |
| `sapa` | soap, the brand colour |
| `pa-sapa` | "on soap", text on a brand fill |
| `lodder` | lather, a light tint for selected states |
| `kant` | border, decorative |
| `kant-kontroll` | border on a control |
| `diskhandske` | rubber glove, the yellow accent |
| `falurod` | Falu red, errors |
| `fokus` | focus ring |
| `-stark` | strong, the darker or lighter partner of a fill |

## Colour

The system has two themes that mirror each other. Light is the positive version, cream ground with soap-green brand. Dark is the negative version, soap-green ground with cream brand.

| Token | Light | Dark | Use |
|---|---|---|---|
| `grund` | `#F3EBD6` | `#1E4A35` | Page background |
| `yta` | `#FBF7EC` | `#173B2A` | Cards, text fields, dialogs |
| `yta-sankt` | `#E8DEC3` | `#122F22` | Code blocks, footer, disabled fields |
| `text` | `#16261D` | `#F3EBD6` | Body text and headings |
| `text-dampad` | `#4F5B4E` | `#C3CCB3` | Secondary text, help text |
| `sapa` | `#1E4A35` | `#F3EBD6` | Logo, primary button fill, links |
| `pa-sapa` | `#F3EBD6` | `#1E4A35` | Text on a `sapa` fill |
| `lodder` | `#CFE0C6` | `#2F6549` | Selected rows and states |
| `kant` | `#D6CCAE` | `#33604A` | Dividers and card borders |
| `kant-kontroll` | `#7A8268` | `#8FAE94` | Borders on inputs and controls |
| `diskhandske` | `#FFD43B` | `#FFD43B` | Accent fill |
| `pa-diskhandske` | `#17140F` | `#17140F` | Text on the accent fill |
| `falurod` | `#8E2B1D` | `#FFB4A2` | Error text |
| `fokus` | `#1E4A35` | `#FFD43B` | Focus ring |

Rules:

- Always use the variable, never a hex value. Then everything follows when the theme changes.
- Let `grund` and `text` carry almost everything. A page is first of all background and text.
- `sapa` flips between the themes. A primary button is green with cream text in light, and cream with green text in dark. Always pair a `sapa` fill with `pa-sapa` text, never with white.
- Put cards and fields on `yta`, and what should step back on `yta-sankt`.
- Use `diskhandske` as a fill for at most one thing per view, with text in `pa-diskhandske`. It is an accent, not a base colour, and never a text colour on a light ground.
- Show errors in `falurod` and always say in words what is wrong.
- Draw control borders in `kant-kontroll`. Use `kant` only for dividers that carry no meaning.
- Separate surfaces with colour and a thin `kant` border, not with shadows.
- All text holds at least 4.5:1 against the surfaces named for its token, in both themes.

## Masking groups

The 21 masking types fall into five colour groups. Each group has a fill and a strong partner.

| Group | Fill | Strong | Light fill / strong | Dark fill / strong | Types |
|---|---|---|---|---|---|
| Name | `mask-namn` | `mask-namn-stark` | `#F4CD97` / `#AA742B` | `#7E613A` / `#F7BD7C` | NAMN |
| Place | `mask-plats` | `mask-plats-stark` | `#99E7C9` / `#099086` | `#1C756E` / `#91F5D4` | PLATS, ADRESS |
| Organisation | `mask-organisation` | `mask-organisation-stark` | `#98C1F4` / `#5F73CA` | `#4469A9` / `#6DA5E1` | ORGANISATION |
| Numbers and identifiers | `mask-nummer` | `mask-nummer-stark` | `#DDAFBC` / `#8F344B` | `#853644` / `#D88291` | PERSONNUMMER, SAMORDNINGSNUMMER, ORGANISATIONSNUMMER, TELEFON, EPOST, POSTNUMMER, LAGENHETSNUMMER, BANKGIRO, PLUSGIRO, IBAN, KORTNUMMER, KONTONUMMER, IP_ADRESS, URL, JOURNALNUMMER, REGNUMMER |
| Your own words | `mask-ord` | `mask-ord-stark` | `#E4DAFF` / `#533E90` | `#634183` / `#D3B8FE` | ORD |

Rules:

- The group for a type is decided by `typeGroup()` in `src/ui/copy.ts`. That function stays the single place where the mapping lives.
- The fill sits behind an item that will be masked, and behind its placeholder afterwards. Text on a fill is always `text`.
- The strong colour is for the dot in the item list and for the 2 px outline, with a 1 px gap, on an item the user chose to keep. It is never a text colour.
- Both themes have their own strong values. The strong colours from the light theme do not reach 3:1 on the dark ground.
- Use the strong colour on `grund` and `yta` only. On `yta-sankt` in the light theme, Name and Place drop just under 3:1.
- Colour is never the only cue. The five fills sit close together for people with reduced colour vision, so the type name is always written out next to the dot in the list.
- An item with no group uses `lodder` as fill and `kant-kontroll` as outline.
- Placeholders are written exactly as the service outputs them, for example `[NAMN_1]` or `[ORGANISATION_2]`.
- Place is teal and not green on purpose. Green is the brand and `lodder`.

## Typography

| Role | Family | Variable |
|---|---|---|
| Headings | Fraunces | `--font-display` |
| Everything else | Figtree | `--font-text` |
| Placeholders, the key, anything read character by character | JetBrains Mono | `--font-mono` |

| Style | Family | Size / line height | Weight | Extra | Use |
|---|---|---|---|---|---|
| `rubrik-xl` | display | 56 / 60 px | 900 | letter-spacing -0.01em, opsz 144 | Main heading, one per page |
| `rubrik-l` | display | 40 / 46 px | 900 | opsz 144 | Section headings |
| `rubrik-m` | display | 28 / 34 px | 700 | opsz 72 | Sub headings |
| `rubrik-s` | display | 20 / 26 px | 700 | opsz 36 | Headings in cards, panels and dialogs |
| `ingress` | text | 20 / 30 px | 400 | | Lead paragraph under a heading |
| `brod` | text | 16 / 26 px | 400 | | Body text |
| `brod-stark` | text | 16 / 26 px | 600 | | Emphasis, text on buttons |
| `liten` | text | 14 / 20 px | 400 | | Help text, captions, footer |
| `etikett` | text | 12 / 16 px | 600 | letter-spacing 0.04em | Field labels, small overlines |
| `mask` | mono | 14 / 22 px | 500 | | Placeholders and the key |

Rules:

- Every Fraunces heading needs `font-variation-settings: "opsz" <value>, "SOFT" 100, "WONK" 0`. That gives the headings the same soft ends as the logotype. Without it they look like a different typeface.
- Fraunces is for headings only. Buttons, fields and running text are always Figtree.
- Headings are sentence case. Capital letter in the first word and in proper nouns only. No all-caps words.
- Fonts are served from the repo through `fonts.css`. A privacy tool should not call a third-party font server.

## Shape

- Radius: `radius-md` (10 px) on buttons and fields, `radius-lg` (16 px) on cards and panels, `radius-sm` (6 px) on masked items, `radius-full` on pills and dots.
- Spacing comes from the steps `space-1` to `space-16` (4, 8, 12, 16, 24, 32, 48, 64 px). `space-6` inside cards, `space-12` between sections.
- Keyboard focus is a solid ring in `fokus`, 2 px wide with a 2 px offset.
- Buttons are at least 44 px high, small buttons 36 px.
- Content sits in one column, at most 640 px wide.
- One primary button per view. Other buttons are secondary (outlined in `kant-kontroll`) or quiet (underlined text in `sapa`).
- The streaks in the logotype lean 20 degrees and have round ends. If the motif is ever used as decoration it keeps the same angle and the same round ends.

## Logo

- The logotype is the word Skrubba in Fraunces with scrub streaks through the S. Always use the files in `logo/`. Never set the word in a font and never redraw the streaks. The letters are outlines, so no font needs to be loaded.
- Light theme: `skrubba-logotyp-positiv.svg` (soap green) on `grund`, `yta` or white.
- Dark theme: `skrubba-logotyp-negativ.svg` (cream) on the green ground or a darker green.
- `skrubba-logotyp-svart.svg` and `skrubba-logotyp-vit.svg` only where colour is not available.
- The files have no built-in margin. Leave free space of half the logotype's height on all sides.
- Never show the logotype narrower than 120 px. Below that the streaks run together, so use the symbol instead. The aspect ratio is 4.88:1.
- `skrubba-symbol-positiv.svg` and `skrubba-symbol-negativ.svg` are for favicon, app icon and profile picture. The symbol replaces the logotype on small surfaces and never stands next to it.
- Do not tilt, stretch or recolour the logo. No shadow, outline or effect.

## Tone

The interface is in Swedish.

- Address the reader as "du".
- Short, plain sentences that say what happens to the text. For example "Klistra in texten så byter Skrubba ut personuppgifterna."
- No sales language and no exaggeration. No dashes.
- Never state where the text is processed or stored unless it has been checked against how the service really works.

## Reference material

`reference/` shows nine example components built on the tokens: button, text field, segmented switch, mask chip, mask dot, key box, notice, card and a full masking view.

- `reference/screens/` has each one in light and dark side by side.
- `reference/markup.html` has the rendered HTML, so the structure and class names can be read.
- `reference/components.css` has the styles.

They are an illustration of how the tokens combine, not code to adopt. Restyle the app's own components to match. Do not import `components.css` and do not copy the markup wholesale.

Two things in the reference are placeholders and must not be treated as decisions:

- All interface copy. The app's existing copy stays unless Micke says otherwise.
- The key shown as `skr-7f3a-…`. It is invented. The real key format is whatever the app produces.

## Not decided yet

Ask before building on any of these.

- Icons. None are defined. Write actions out in words.
- Whether a kept item keeps its fill inside the outline. The reference shows outline only.
- Print colours (CMYK and Pantone).
- A two-tone version of the logotype streaks.
