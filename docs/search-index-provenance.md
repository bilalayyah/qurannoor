# Search index provenance — `public/quran-search-index.json`

## Source

- **API:** `https://api.quran.com/api/v4` (public Quran Foundation API, no credentials)
- **Endpoint:** `GET /verses/by_chapter/{chapter}?fields=text_qpc_hafs` (paginated, `per_page=50`, all 114 chapters)
- **Arabic source field:** `text_qpc_hafs` (QPC Hafs / Madinah Mushaf text)
- **Generation script:** `scripts/regenerate-search-index.mjs`
- **Generated / last verified:** 2026-11-18
- **Schema:** one JSON array of 6,236 rows; each row is
  `[verseKey, arabic, english]`
  - `arabic` — `text_qpc_hafs` with the trailing ayah-end marker (whitespace +
    Arabic-Indic digits, e.g. ` ٥`) stripped, exactly as the readers display
    it (same rule as `stripQpcHafsEndMarker` in `src/utils/text.ts`). The verse
    text itself is never edited, typed, or paraphrased.
  - `english` — Saheeh International, preserved byte-for-byte by the script;
    only the Arabic element is rebuilt from the API.

## Urdu removal (2026-11-21)

The Urdu element (Fateh Muhammad Jalandhari, element [3] of the old
4-element rows) was removed: rows are now 3 elements
`[verseKey, arabic, english]`. The strip was done locally from the
committed file (no API fetch) with Arabic + English verified byte-identical
to the pre-strip file (6,236 rows, 0 U+06DF, 2:5/2:6 spot checks unchanged).
File size: 3,731,816 → 2,305,487 bytes. The regenerate script
(`scripts/regenerate-search-index.mjs`) still works on 3-element rows — it
only ever replaces element [1] (Arabic) and preserves the rest.

## Verification (2026-11-18)

Regenerating from the live API produced a file **byte-identical in content**
to the committed index (0 of 6,236 rows differ):

- Rows: **6,236** (all ayahs, every verse key covered by the API)
- U+06DF occurrences in the Arabic: **0**
- Spot checks vs the API — `2:5`
  `أُوْلَٰٓئِكَ عَلَىٰ هُدٗى مِّن رَّبِّهِمۡۖ وَأُوْلَٰٓئِكَ هُمُ ٱلۡمُفۡلِحُونَ`
  and `2:6`
  `إِنَّ ٱلَّذِينَ كَفَرُواْ سَوَآءٌ عَلَيۡهِمۡ ءَأَنذَرۡتَهُمۡ أَمۡ لَمۡ تُنذِرۡهُمۡ لَا يُؤۡمِنُونَ`
  — both match `text_qpc_hafs` (end marker stripped).

## Correction to audit finding M-8

The audit (2026-11-18) stated the index Arabic was Uthmani (`text_uthmani`),
not QPC. That premise was **incorrect**: `text_uthmani` and `text_qpc_hafs`
are different API fields (e.g. for 2:5, `text_uthmani` contains U+06DF in
`أُو۟لَـٰٓئِكَ` and different diacritics, while `text_qpc_hafs` does not),
and the committed index matches `text_qpc_hafs` on all 6,236 rows. The
Methodology page's claim that the displayed Arabic comes from
`text_qpc_hafs` (`src/pages/InfoPages.tsx`) is therefore **true for search
results and bookmarks as well as readers**, and no wording change was needed.

## Re-running

```sh
node scripts/regenerate-search-index.mjs /tmp/quran-search-index.new.json
# verify the script's output (rows, U+06DF count, spot checks), then:
cp /tmp/quran-search-index.new.json public/quran-search-index.json
```

If the API returns no changes, the regenerated file is byte-identical to the
committed one (zero git diff). The script is gentle with the API (paced
requests, exponential back-off on 429/5xx) and refuses to write if any row
is missing, empty, or contains U+06DF.
