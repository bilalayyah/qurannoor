#!/usr/bin/env node
/**
 * Regenerate the local search index (public/quran-search-index.json) from the
 * official Quran Foundation API field `text_qpc_hafs`.
 *
 * Provenance
 * -----------
 * - Source API: https://api.quran.com/api/v4 (public, no credentials needed)
 * - Endpoint: GET /verses/by_chapter/{chapter}?fields=text_qpc_hafs
 *   (paginated with per_page=50 across all 114 chapters)
 * - Source field: text_qpc_hafs (QPC Hafs / Madinah Mushaf text)
 * - Generated: 2026-11-18
 * - Audit finding fixed: M-8 (search/bookmark Arabic was Uthmani, not QPC;
 *   the Methodology page's text_qpc_hafs claim was false for those surfaces)
 *
 * What this script does
 * ---------------------
 * 1. Fetches every ayah's `text_qpc_hafs` from the API (all 6,236 ayahs).
 * 2. Loads the existing index and replaces ONLY the Arabic text (element [1]
 *    of each [verseKey, arabic, en] row). The English (Saheeh
 *    International) translation is preserved byte-for-byte, and no row is
 *    added, removed, or reordered. (Urdu was element [3] until its removal
 *    on 2026-11-21; rows are 3 elements since then.)
 * 3. Strips the trailing ayah-end marker (whitespace + Arabic-Indic digits,
 *    e.g. " ٥") from the API text with the same rule the reader uses
 *    (see stripQpcHafsEndMarker in src/utils/text.ts), so search/bookmark
 *    Arabic is byte-identical to what the readers display. This is a
 *    presentation strip of the end marker only — the verse text itself is
 *    never edited, typed, or paraphrased.
 * 4. Verifies the result before writing: exactly 6,236 rows, every verse key
 *    covered by the API, and 0 occurrences of U+06DF (the black-dot code
 *    point) in the Arabic.
 *
 * Usage
 * -----
 *   node scripts/regenerate-search-index.mjs [output-path]
 *
 * The output defaults to /tmp/quran-search-index.new.json. Verify it, then
 * copy it into place with `cp` (do NOT write directly into public/).
 * Re-running the script is safe: it always rebuilds from the live API.
 * The output is written WITHOUT a trailing newline so a regeneration that
 * finds no changes produces a byte-identical file (zero git diff).
 *
 * Rate limiting: requests are paced (~120 ms apart) and retried with
 * exponential back-off on 429 / 5xx responses.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API_BASE = 'https://api.quran.com/api/v4';
const PER_PAGE = 50;
const TOTAL_CHAPTERS = 114;
const EXPECTED_ROWS = 6236;
const REQUEST_DELAY_MS = 120;
const MAX_ATTEMPTS = 5;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(repoRoot, 'public', 'quran-search-index.json');
const outputPath = process.argv[2] ?? '/tmp/quran-search-index.new.json';

/** Same rule as stripQpcHafsEndMarker in src/utils/text.ts. */
function stripQpcHafsEndMarker(text) {
  if (!text) return '';
  return text.replace(/[\s\u00A0]+[\u0660-\u0669]+$/, '');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) return res.json();
    lastError = new Error(`HTTP ${res.status} for ${url}`);
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * 2 ** (attempt - 1);
      console.warn(`  ${res.status} — backing off ${delay} ms (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await sleep(delay);
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

async function fetchChapterQpc(chapterId) {
  const verses = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${API_BASE}/verses/by_chapter/${chapterId}?fields=text_qpc_hafs&per_page=${PER_PAGE}&page=${page}`;
    const data = await fetchJsonWithRetry(url);
    if (!Array.isArray(data.verses) || data.verses.length === 0) break;
    verses.push(...data.verses);
    const totalPages = data.pagination?.total_pages;
    if (!totalPages || page >= totalPages) break;
    page += 1;
    await sleep(REQUEST_DELAY_MS);
  }
  return verses;
}

async function main() {
  const qpcByKey = new Map();
  for (let chapter = 1; chapter <= TOTAL_CHAPTERS; chapter += 1) {
    const verses = await fetchChapterQpc(chapter);
    for (const v of verses) {
      if (!v.verse_key || typeof v.text_qpc_hafs !== 'string') {
        throw new Error(`Chapter ${chapter}: verse missing verse_key/text_qpc_hafs: ${JSON.stringify(v)}`);
      }
      qpcByKey.set(v.verse_key, stripQpcHafsEndMarker(v.text_qpc_hafs));
    }
    if (chapter % 20 === 0 || chapter === TOTAL_CHAPTERS) {
      console.log(`  chapters 1–${chapter} fetched (${qpcByKey.size} ayahs so far)`);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  console.log(`Fetched ${qpcByKey.size} ayahs from text_qpc_hafs`);

  const rows = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(rows) || rows.length !== EXPECTED_ROWS) {
    throw new Error(`Existing index has ${Array.isArray(rows) ? rows.length : 'non-array'} rows, expected ${EXPECTED_ROWS}`);
  }

  let replaced = 0;
  let unchanged = 0;
  const missing = [];
  for (const row of rows) {
    const [key, oldAr] = row;
    const qpc = qpcByKey.get(key);
    if (qpc === undefined) {
      missing.push(key);
      continue;
    }
    if (oldAr !== qpc) replaced += 1;
    else unchanged += 1;
    row[1] = qpc; // Arabic only; EN/UR translations untouched.
  }
  if (missing.length > 0) {
    throw new Error(`API did not return text_qpc_hafs for ${missing.length} keys: ${missing.slice(0, 10).join(', ')}`);
  }

  // Verification: row count, U+06DF count, and no empty Arabic.
  const arabicJoined = rows.map((r) => r[1]).join('');
  const dotCount = (arabicJoined.match(/\u06DF/g) || []).length;
  const empty = rows.filter((r) => !r[1]).length;
  if (rows.length !== EXPECTED_ROWS) throw new Error(`Row count ${rows.length} != ${EXPECTED_ROWS}`);
  if (dotCount !== 0) throw new Error(`U+06DF found ${dotCount} times — refusing to write`);
  if (empty !== 0) throw new Error(`${empty} rows have empty Arabic — refusing to write`);

  writeFileSync(outputPath, JSON.stringify(rows), 'utf8');
  console.log(`Wrote ${outputPath}`);
  console.log(`Rows: ${rows.length} | Arabic replaced: ${replaced} | already identical: ${unchanged}`);
  console.log(`U+06DF occurrences in Arabic: ${dotCount} | empty Arabic rows: ${empty}`);
  for (const key of ['2:5', '2:6']) {
    console.log(`Spot check ${key}: ${qpcByKey.get(key)}`);
  }
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
