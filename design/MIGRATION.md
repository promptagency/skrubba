# First task: move the app onto the design tokens

Give this file to Claude Code as the brief. It is done once, then it can be deleted.

## Goal

The app looks like the Skrubba design programme in both themes, and every colour, font, spacing and radius value comes from `design/tokens.css`. Nothing else changes.

## Out of scope

- No layout changes and no new components.
- No changes to copy, behaviour or the masking logic.
- No changes to `typeGroup()` or to which type belongs to which group.

## Steps

1. Read `design/DESIGN.md`.
2. Load `design/fonts.css` and `design/tokens.css` before `src/ui/styles.css`. If the build cannot reach the folder from where it sits, move `tokens.css`, `fonts.css` and `fonts/` under `src/` and update the paths in `DESIGN.md`. Keep the relative path between `fonts.css` and `fonts/`.
3. In the `:root` block of `src/ui/styles.css`, keep the variable names the components already use and point each one at a token, for example `--accent: var(--sapa)`. The components should not need to change for the colours to change.
4. Remove the old values for dark mode and wire the dark block in `tokens.css` to the theme switch the app already has. Change the selector in `tokens.css` if needed. Do not run two mechanisms side by side.
5. Masking colours. Point the five fill variables at `--mask-<group>` and the five darker shades at `--mask-<group>-stark`. The darker shades were the same in both modes before. They now differ per theme, and that comes for free once they point at the tokens.
6. Brand accent. Replace `#1f5f4a` and `#6fc3a3` with `var(--sapa)`. In dark, `sapa` is cream and not green, so check every place the accent is used as a fill and make sure its text is `var(--pa-sapa)`, not white.
7. Fonts. Headings in `var(--font-display)` with the variation settings from `DESIGN.md`, everything else in `var(--font-text)`, placeholders and the key in `var(--font-mono)`. Map the existing type sizes to the nearest style in the type table.
8. Logo and favicon. Use the files in `design/logo/`, positive in light and negative in dark. Switch between them with the same mechanism as the theme, so the two can never disagree.
9. Search `src/` for any remaining hex colour, `rgb(` value or font name outside `design/` and replace it with a variable.

## When something does not fit

- An existing variable with no matching token: do not invent a value. List it in the report with where it is used and what it looks like today.
- A token used on a surface its rule does not allow (for example a strong mask colour on `yta-sankt`): list it.
- Anything under "Not decided yet" in `DESIGN.md`: leave as it is today and list it.

## Done when

- The build and the type check pass.
- No hex, `rgb(` or font-family name is left in `src/`, apart from the token files if they were moved there.
- There are screenshots before and after, in light and dark, of at least: empty start, text pasted with items found, one item kept, masked result with the key, restore mode, and an error.
- The report lists the alias table (old variable to token), everything that did not fit, and anything that looks worse than before.
