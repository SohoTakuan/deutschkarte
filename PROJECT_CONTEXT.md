# DeutschKarte — Technical Context & Agent Memory

> [!IMPORTANT]
> **Agent Rules (Read First):**
> 1. **Context Separation:** Read this file (`PROJECT_CONTEXT.md`) **only** for DeutschKarte app features, UI/design updates, bug fixes, or adding vocabulary lessons. For Germany university admissions, language study strategy, `anabin`, or `36F` visa advising, read **only** local `ALMANYA_HEDEF_PLANI.md` (do not scan app source files).
> 2. **Output & Content Language:** Write **all** user-facing UI labels, feedback, study tips, and direct responses to the user in **natural Turkish**. Verify all German vocabulary, articles, plurals, and example sentences against **Duden** standards.
> 3. **Mandatory Self-Update & Deploy:** After **any** feature addition, UI/design edit, bug fix, security change, or new vocabulary lesson (even if unprompted), update this file (keep only the last 4–5 releases in **Recent Releases**), verify syntax/checks, and push tracked changes (`git add`, `git commit`, `git push`) to deploy live.
> 4. **Public Repo Privacy:** Never write local OS user paths (`C:\Users\...`), real email addresses, personal access tokens/secrets, or `ALMANYA_HEDEF_PLANI.md` into tracked files or commits.

---

## 1. Repository & Design System

- **GitHub Repository:** `https://github.com/SohoTakuan/deutschkarte` (branch: `main`)
- **Live PWA (GitHub Pages):** `https://sohotakuan.github.io/deutschkarte/`
- **Design System Reference:** `~/.gemini/config/skills/frontend-design/SKILL.md`
  - **Tokens:** Tactile Leitner index card aesthetic; Archival stone-linen Light Mode (`--desk: #ECEAE4`, `--card: #FDFCFA`, `--ink: #132033`, `--btn-primary-bg: #132033`, `--btn-primary-ink: #FDFCFA`, `--summary-surface: #132033`) + Neutral Charcoal-Slate Dark Mode (`--desk: #111418`, `--desk-subtle: #181D24`, `--card: #1A1F26`, `--ink: #F0F2F5`, `--btn-primary-bg: #E6ECF4`, `--btn-primary-ink: #111418`, `--summary-surface: #202630`).
  - **Strict Article-Color Rule:** Reserve `--accent-der`, `--accent-die`, `--accent-das`, `--accent-pl`, `--accent-sg`, and `--on-accent: #FFFFFF` strictly for German articles and correct/wrong feedback; use monochrome ink/graphite everywhere else (primary buttons, focus rings, `.box-pips`, custom dropdowns/switches, `#card-round-summary`, and heatmap).
  - **Typography:** `Bricolage Grotesque` (headings) + `Source Sans 3` (body). Avoid ALL-CAPS interface labels, monospace chrome, template SaaS shadows, or AI-style arrow/bullet chrome.

---

## 2. File Architecture

### Tracked Application Files (Public Repo)
- `index.html`: App shell (`Çalış`, `Çekim ve Notlar`, `Kelime Sözlüğü`, theme toggle, collapsible practice mode shelf + `Günün Kartları` hero mode, 2-tab `İlerleme ve Ayarlar` modal, `Almanca Asistan` drawer), strict CSP (`script-src 'self'`, `img-src 'self'`, `media-src 'none'`, `frame-src 'none'`, zero `'unsafe-inline'`, `connect-src 'self' https://api.github.com https://gist.githubusercontent.com https://generativelanguage.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com`), `referrer="no-referrer"`, `notranslate` guard, PWA metadata.
- `theme-init.js`: External anti-flash theme initializer (`deutschkarte_theme` in `localStorage`, `#1A1F26` / `#132033` `theme-color`).
- `boot-guard.js`: `file://` protocol warning banner and 3-second boot-recovery watchdog.
- `custom-select.js`: Reusable accessible custom `<div role="listbox">` dropdown (`createCustomSelect`, `closeAllCustomSelects`) with flat/grouped options, monochrome styling, keyboard navigation (`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`/`Space`/`Escape`/`Tab`), and outside-click close.
- `tts-cache.js`: Standalone persistent IndexedDB audio clip cache (`deutschkarte_tts_cache_v1`, `clips` store, capped at `600` entries / `100 MB` with oldest-entry pruning; `getCachedTtsAudio`, `putCachedTtsAudio`, `getTtsCacheStats`, `clearTtsCache`).
- `styles.css`: Light/Dark design tokens, responsive layout (`760px`, `640px`), monochrome controls/switches (`zero accent-color`), tactile Leitner card + `.cloze-blank` + post-answer `.ai-coach-bar` / `.coach-panel`, 4-week neutral heatmap with edge-clamped `[data-tooltip]`, grammar/dictionary views, AI drawer, and `prefers-reduced-motion` support.
- `app.js`: Study engine (`Karma`, `Şıklı`, `Yazmalı`, `Artikel`, `Boşluk`, `Tekrar`, `Zorlandıklarım`; `TR -> DE` active production; preserves unanswered word across mode switches), 5-box Leitner SRS with soft demotion (`Math.max(1, prev.box - 2)`), Option A fixed local calendar-day (`00:00`) due queue (`isCardDue`, `getNextReviewTimestamp`; same-day mistakes in other modes schedule for tomorrow `00:00` instead of inflating today's due list, while mistakes inside `Tekrar` stay due until solved), `maxBox` threshold-unlock (once Box 4 or Box 5 is reached, recovering back up to `maxBox` bypasses cooldown & Box 3→4 production gates), dynamic recent-card cooldown + timed-round non-repeat + balanced draw weights (`debtBoost` up to `2.05x`, mistake cap `10`), `debt` (`-3..0`, accumulates only while `correct === 0` and never deepens once `correct > 0`), Box 3→4 production gate + 1d/7d cooldown gate (`heldByCooldown`), cross-lesson `Tekrar` due queue (`getDueWords`), Karma Box 3–5 35% Cloze, 4-week (28-day) heatmap (`dailyHistory` pruned to 60 days), segmented rounds (`off`/`10`/`20`), post-answer **Cümle Kur** & **Artikel İpucu** coach panels, verb conjugation drill & notes, hybrid `de-DE` TTS (scored natural browser voice + Web Audio API playback for cached Gemini TTS via `speechEngine` setting, `Alt+S`), word hide/restore, `deutschkarte_state_v1` `localStorage`, 1 MB JSON backup, and `buildAiScreenContext` provider.
- `ai-tutor.js`: Floating **Almanca Asistan** BYOK Gemini Flash drawer (`deutschkarte_ai_tutor_v1` in `localStorage` or `sessionStorage`, `x-goog-api-key`, fallback chain `gemini-3.8-flash` -> `gemini-3.6-flash` with per-model 429/503/404 cooldowns, strict card-context & spelling verification in `SYSTEM_INSTRUCTION`, 6-turn history window, 15s timeout, 1500-char prompt cap, safe DOM markdown-lite, `Ekran bağlamını kopyala`), Structured JSON endpoints (`evaluateUserSentence` & session-cached `generateArticleMnemonic`), and session-cached Gemini Natural TTS (`synthesizeGermanSpeech` fallback chain `gemini-3.8-flash-lite-tts` -> `gemini-3.8-flash-tts` -> `gemini-2.5-flash-preview-tts` with cooldown & `getTtsStatusInfo`, 120-item cache).
- `sync.js`: Offline-first GitHub Gist sync (`deutschkarte_gist_sync_v1`, `deutschkarte-sync.json`, Gist ID/token/origin/schema validation, `speechEngine` + `maxBox` + `debt` + `dailyHistory` + `mistakeClearedAt`/`hiddenWords`/`hiddenRestoredAt` tombstones, `resetAt` dominance).
- `manifest.json`: PWA web app manifest (`icons/icon-192.png`, `icons/icon-512.png`).
- `sw.js`: Network-first same-origin (`response.type === "basic"`) + cache fallback, Google Fonts stale-while-revalidate. Currently `CACHE_VERSION = "deutschkarte-v55"`.
- `scripts/check-lessons.mjs`: Automated Node ESM validator for lesson schema, Duden article rules, hint leakage, and Cloze-mode unambiguity (`er`/`sie`/`es`, formal `Sie`, register/context cues).
- `icons/`: `icon.svg`, `icon-192.png`, `icon-512.png` (maskable safe-zone compliant).
- `baslat.bat`: Windows local Python HTTP server launcher (`http://localhost:8000`).
- `data/lesson_01.js`: A1 Lesson 1 (71 Duden-verified items + `example: { de, tr }`).
- `data/lesson_02.js`: A1 Lesson 2 (84 Duden-verified items + `example: { de, tr }`).
- `data/lesson_03.js`: A1 Lesson 3 (81 Duden-verified items + `example: { de, tr }`; 236 A1 items total).
- `data/grammar.js`: `PRONOUN_SLOTS`, `VERB_GROUPS`, `CONJUGATION_VERBS` (13 A1 verbs), and `GRAMMAR_NOTES` (5 study note cards + tables).
- `data/index.js`: Aggregates `LESSONS`, deduplicates `ALL_WORDS`, exports `LEVEL_ORDER`, `getLessonList`, `getWordsForLesson`, `getLevelSummary`, `getLessonSummary`.
- `.nojekyll` & `.gitignore`: Static serving flag and ignore rules (blocks personal docs, raw notes, media, backups, and secrets).
- `PROJECT_CONTEXT.md`: This technical memory file.

### Local-Only Ignored File
- `ALMANYA_HEDEF_PLANI.md`: Personal Germany study, `anabin`, and `36F` visa plan (listed in `.gitignore` — **never** commit or push).

---

## 3. Data Schema & Duden Rules

### Lesson Export (`data/lesson_XX.js`)
```js
export default {
  id: "lesson_XX",
  level: "A1" | "A2" | "B1" | "B2" | "C1",
  title: "Ders X",
  subtitle: "...",
  items: [...]
};
```
- **Item ID format:** `l{lessonNumber}_{twoDigitIndex}` (e.g., `l1_01`–`l1_71`, `l2_01`, ..., `l10_01`).

### Noun Schema (`category: "noun"`)
```js
{
  id: "l1_01",
  category: "noun",
  lesson: "Ders 1",
  tr: "spor",
  article: "der",          // MUST be "der" | "die" | "das" (Duden)
  singular: "Sport",
  plural: "",              // empty string if onlySingular: true
  onlySingular: true,      // optional boolean
  onlyPlural: false,       // optional boolean
  hint: "...",             // optional pre-answer Turkish/grammar hint (NO German words!)
  note: "...",             // optional post-answer + dictionary note (German allowed)
  example: { de: "...", tr: "..." }
}
```
> [!CAUTION]
> **Critical Noun & Cloze Rules:**
> 1. For `onlySingular: true` nouns (e.g., `der Sport`, `die Musik`), `article` **MUST** remain the real Duden article (`"der" | "die" | "das"`), **never** `"nur Sg."`. The app automatically accepts both the real article and `"nur Sg."` in checks.
> 2. Put German-containing grammar explanations in `note` (shown after answering & in dictionary), **never** in `hint` (shown before answering).
> 3. **Cloze Unambiguity Rule:** Every `example: { de, tr }` must uniquely determine the blanked target word/phrase in Cloze mode:
>    - **`er` / `sie` / `es`:** Include an explicit gender, referent, or plural-verb cue outside the blank (e.g., a gendered name/title like `Anna` or `Taxifahrer`, a neuter noun like `das Hotel`, or an impersonal phrase).
>    - **Formal `Sie`:** Include a formal greeting/address cue outside the blank or in `tr` (e.g., `Guten Tag, Frau Weber!`, `Entschuldigung`, `bitte`).
>    - **Register / context-sensitive items (`Mama`, `Papa`, `Auf Wiederhören`, `Hier ist ...`):** Include the distinguishing cue in `example.de` or `example.tr` (e.g., `(samimi)`, `Telefongespräch`, `(telefonda)`).

### Phrase / Verb Schema (`category: "phrase" | "verb"`)
```js
{
  id: "l1_50",
  category: "phrase" | "verb",
  lesson: "Ders 1",
  tr: "Merhaba",
  de: "Hallo",
  alt: ["..."],            // optional accepted German variants
  hint: "...",
  note: "...",
  example: { de: "...", tr: "..." }
}
```

---

## 4. Standard Protocols

### Protocol 1: Adding New Lessons from Notes / PDFs
1. Create `data/lesson_XX.js` with CEFR `level` and register it in `data/index.js` (do **not** touch `app.js`, `styles.css`, or `index.html` when only adding vocabulary).
2. Verify every word against **Duden** (spelling, `ä/ö/ü/ß`, `article`, `plural`, `onlySingular`/`onlyPlural`), write natural Turkish meanings, and add a level-appropriate `example: { de, tr }`.
3. Deduplicate against `ALL_WORDS` in `data/index.js`.
4. Add `./data/lesson_XX.js` to `PRECACHE_URLS` and bump `CACHE_VERSION` in `sw.js`.
5. Update `PROJECT_CONTEXT.md`, run `node --check` and `node scripts/check-lessons.mjs`, verify privacy rules, and push to `origin main`.

### Protocol 2: UI Changes & Feature Development
1. Follow `~/.gemini/config/skills/frontend-design/SKILL.md` and the Section 1 strict article-color rule with natural Turkish copy.
2. **Security & State Gates:** Keep strict `script-src 'self'` CSP (zero inline scripts or `onclick`), `referrer="no-referrer"`, `deutschkarte_state_v1` backwards compatibility, `sync.js` tombstones (`mistakeClearedAt`, `hiddenWords`/`hiddenRestoredAt`) and `resetAt` dominance (`saveState({ sync: true })` for learning state vs `{ sync: false, preserveTimestamp: true }` for view-only changes), and token isolation in `deutschkarte_gist_sync_v1` / `deutschkarte_ai_tutor_v1`.
3. Update `sw.js` (`PRECACHE_URLS` + `CACHE_VERSION`), run `node --check` + unit/browser verification, update `PROJECT_CONTEXT.md`, and push to `origin main`.

---

## 5. Feature Backlog (Roadmap to A2–C1 / 300+ Words)

- **Long-term SRS:** Add `60 / 120 day` intervals for Box 5+ mastery.
- **Grammar Expansion:** Add verb `Perfekt` (`hat/ist` + `Partizip II`) and `Präposition + Kasus` fields.

---

## 6. Recent Releases (Rolling Last 4–5)

*Keep only the latest 4–5 releases here; full history lives in `git log`.*

- **`v49`:** Removed `gemini-3.5-flash-lite` from `ai-tutor.js` (defaulting to `gemini-3.8-flash` -> `gemini-3.6-flash`) and tightened `SYSTEM_INSTRUCTION` to enforce context-answer comparison and letter verification, bumping `sw.js` to `deutschkarte-v49`.
- **`v50`:** Added compact 5-pip Leitner box indicators (`populateBoxPips`, `.dict-box-pips`) to studied, non-hidden words in `Kelime Sözlüğü` so users can see exact box progress (0–5) alongside the SRS status tag, bumping `sw.js` to `deutschkarte-v50`.
- **`v51`:** Added A1 Lesson 3 (`data/lesson_03.js`, 81 Duden-verified items covering numbers, phone numbers, addresses, and official office vocabulary; 236 A1 items total), registered it in `data/index.js`, and bumped `sw.js` to `deutschkarte-v51`.
- **`v54`:** Fixed Cloze-mode cue ambiguities in Lesson 3 (`l3_16`, `l3_60` A1 example & `kısa biçim` cue, `l3_79`), added `(kısa biçim)` / `(uzun biçim)` Cloze validation to `scripts/check-lessons.mjs`, and bumped `sw.js` to `deutschkarte-v54`.
- **`v55`:** Added accepted `alt` variants for phone/number questions in Lesson 3 (`l3_75`, `l3_76`, `l3_80`, `l3_81`), bumping `sw.js` to `deutschkarte-v55`.
