# maskeraDomain.json

maskera's privacy-safe Swedish domain regression corpus: 258 synthetic texts
with 952 annotated values, in 13 categories (healthcare, law, banking, school,
internal chat, phone transcripts, …). Structured values come from published
test fixtures and the prose was written for the corpus; none of it comes from
real records. Used by `../domain.model.test.ts`.

- Source: https://github.com/joelhagvall/maskera, `packages/ner/eval/domain-regression/corpus/`
- Commit: `5da8b105aae6cd5a1c6f3ad7955787fff8d4db90` (2026-10-11)
- Converted from the `.mjs` files to one JSON array, fields unchanged (`id`, `kategori`, `text`, `forvantad`).

MIT License, Copyright (c) 2026 Joel Hägvall. The full licence text is in
maskera's repository and in `node_modules/maskera/LICENSE`.
