# DeutschKarte — Technical Context & Agent Memory

> [!IMPORTANT]
> **Agent Rules (Read First):**
> 1. **Context Separation:** Read this file (`PROJECT_CONTEXT.md`) **only** for DeutschKarte app features, UI/design updates, bug fixes, or adding vocabulary lessons. For Germany university admissions, language study strategy, `anabin`, or `36F` visa advising, read **only** local `ALMANYA_HEDEF_PLANI.md` (do not scan app source files).
> 2. **Output & Content Language:** Write **all** user-facing UI labels, feedback, study tips, and direct responses to the user in **natural Turkish**. Verify all German vocabulary, articles, plurals, and example sentences against **Duden** standards.
> 3. **Mandatory Self-Update & Deploy:** After **any** feature addition, UI/design edit, bug fix, security change, or new vocabulary lesson (even if unprompted), update this file (file list, schema/architecture, and **Changelog**), verify syntax/checks, and push tracked changes (`git add`, `git commit`, `git push`) to deploy live.
> 4. **Public Repo Privacy:** Never write local OS user paths (`C:\Users\...`), real email addresses, personal access tokens/secrets, or `ALMANYA_HEDEF_PLANI.md` into tracked files or commits.

---

## 1. Repository & Live Deployment

- **GitHub Repository:** `https://github.com/SohoTakuan/deutschkarte` (branch: `main`)
- **Live PWA (GitHub Pages):** `https://sohotakuan.github.io/deutschkarte/`
- **Design System Reference:** `~/.gemini/config/skills/frontend-design/SKILL.md`
  - **Tokens:** Tactile Leitner index card aesthetic; Light Mode (`--desk`, `--card`, `--ink`) + Prussian-night Dark Mode; `--accent-der`, `--accent-die`, `--accent-das`, `--accent-pl`, `--accent-sg`, `--on-accent: #FFFFFF`.
  - **Typography:** `Bricolage Grotesque` (headings) + `Source Sans 3` (body). Avoid ALL-CAPS interface labels, monospace chrome, template SaaS shadows, or AI-style arrow/bullet chrome.

---

## 2. File Architecture

### Tracked Application Files (Public Repo)
- `index.html`: App shell (`Çalış`, `Çekim ve Notlar`, `Kelime Sözlüğü`, theme toggle, `İlerleme` modal, floating `Almanca Asistan` bubble + drawer), strict Content-Security-Policy (`script-src 'self'`, `img-src 'self'`, `media-src 'none'`, `frame-src 'none'`, zero `'unsafe-inline'`, `connect-src 'self' https://api.github.com https://gist.githubusercontent.com https://generativelanguage.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com`), `referrer="no-referrer"`, PWA metadata.
- `theme-init.js`: External anti-flash theme initializer (`localStorage` key `deutschkarte_theme`).
- `boot-guard.js`: `file://` protocol warning banner and 3-second boot-recovery watchdog (`Önbelleği temizle ve yenile`).
- `styles.css`: Light + Prussian-night dark mode tokens, Leitner card layout, grammar/conjugation drill + note tables, floating AI tutor bubble & mobile bottom-sheet drawer, umlaut bar, responsive breakpoints (`760px`, `640px`, `400px`), accessible focus states, `prefers-reduced-motion` support.
- `app.js`: Study engine (`Karma Mod`, `Sadece Şıklı`, `Sadece Yazmalı`, `Artikel Pratiği`, `Zorlandıklarım`), bidirectional `TR / DE` & `DE / TR`, 5-box Leitner SRS (`cards`), daily goal/streak (`daily` anchored to local calendar date), interactive verb conjugation drill (`Çekim Pratiği` with session mistake weighting & speech) + structured study notes (`Ders Notları ve Tablolar`), `de-DE` Web Speech API (`Alt+S` + optional `autoSpeak`, `keepAiOpen` toggle), lesson/CEFR level filters, theme controller, independent noun/article/plural validation, umlaut bar (`ä`, `ö`, `ü`, `ß`, `Aa`), keyboard shortcuts (`1`–`4`, `Enter`), dictionary search/filters, in-app word hide/restore (`Gizle` / `Gizlenenler` + 1-tap `Geri al` undo toast), `localStorage` (`deutschkarte_state_v1`), 1 MB-capped JSON export/import backup with `Number.isFinite` sanitization, Gist sync integration, and live context provider (`buildAiScreenContext`) for `ai-tutor.js`.
- `ai-tutor.js`: Mobile-friendly floating **Almanca Asistan** bubble and context-aware chat drawer (`deutschkarte_ai_tutor_v1` in `localStorage` or optional `sessionStorage` tab-only mode, selectable 3-model Flash lineup + automatic fallback chain `gemini-3.8-flash` -> `gemini-3.6-flash` -> `gemini-3.5-flash-lite` with 15s per-attempt timeout & session-sticky healthy model, isolated from sync/backup; printable-ASCII key validation; `credentials: "omit"`, `cache: "no-store"`, `referrerPolicy: "no-referrer"`; `x-goog-api-key` header; 1500-char prompt cap; redacted error messages; safe DOM markdown-lite rendering; dynamic context-aware quick chips; 1-tap `Ekran bağlamını kopyala` fallback).
- `sync.js`: Offline-first GitHub Gist cloud sync (`deutschkarte_gist_sync_v1`, remote filename `deutschkarte-sync.json`, `isValidGistId` `/^[a-fA-F0-9]{8,64}$/`, `isValidTokenFormat` printable-ASCII check, `credentials: "omit"` + 20s timeout + 1 MB fetch cap, `https://gist.githubusercontent.com` origin verification, `parsed.app === "DeutschKarte"` payload validation, `Number.isFinite` + `dailyGoal` + `YYYY-MM-DD` sanitization, timestamped `mergeStates`, `mistakeClearedAt` + `hiddenWords`/`hiddenRestoredAt` tombstones, `resetAt` dominance).
- `manifest.json`: PWA web app manifest (`icons/icon-192.png`, `icons/icon-512.png`).
- `sw.js`: Network-first same-origin (`response.type === "basic"`) + cache fallback (`ignoreSearch: true`), Google Fonts stale-while-revalidate. Currently `CACHE_VERSION = "deutschkarte-v16"` and `PRECACHE_URLS` (`./`, `./index.html`, `./styles.css`, `./theme-init.js`, `./boot-guard.js`, `./app.js`, `./ai-tutor.js`, `./sync.js`, `./manifest.json`, `./data/index.js`, `./data/lesson_01.js`, `./data/lesson_02.js`, `./data/grammar.js`, `./icons/icon.svg`, `./icons/icon-192.png`, `./icons/icon-512.png`).
- `icons/`: `icon.svg`, `icon-192.png`, `icon-512.png` (maskable safe-zone compliant).
- `baslat.bat`: Windows local Python HTTP server launcher (`http://localhost:8000`) guarding against the Windows Store `python` alias stub.
- `data/lesson_01.js`: Lesson 1 (`level: "A1"`, 71 Duden-verified items with A1 `example: { de, tr }`: 49 nouns, 18 phrases, 4 verbs).
- `data/lesson_02.js`: Lesson 2 (`level: "A1"`, 84 Duden-verified items with A1 `example: { de, tr }`: 30 nouns, 13 verbs with principal parts, 41 pronouns/phrases/question words; total 155 A1 items across Lessons 1–2).
- `data/grammar.js`: `PRONOUN_SLOTS`, `VERB_GROUPS`, `CONJUGATION_VERBS` (13 A1 verbs across regular, `-t/-d` `-e-` insertion, and irregular groups), and `GRAMMAR_NOTES` (5 structured study note cards + tables).
- `data/index.js`: Aggregates `LESSONS` (`lesson01`, `lesson02`), deduplicates `ALL_WORDS` by `id`, normalizes `level`, `lessonId`, and `lesson`, exports `LEVEL_ORDER`, `getLessonList`, `getWordsForLesson`, `getLevelSummary`.
- `.nojekyll` & `.gitignore`: Static serving flag and ignore rules (blocks `ALMANYA_HEDEF_PLANI.md`, `.env`, `*token*`, `*secret*`, `*.key`, `*.pem`, `deutschkarte-yedek-*.json`, `*.pdf`, `*.docx`, `*.txt`, `*.jpg`, `*.jpeg`, `*.heic`, `*.webp`, `*.png` except `icons/*.png`, `ham_notlar/`, OS noise).
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
> **Critical Noun Rules:**
> 1. For `onlySingular: true` nouns (e.g., `der Sport`, `die Musik`), `article` **MUST** remain the real Duden article (`"der" | "die" | "das"`), **never** `"nur Sg."`. The app automatically accepts both the real article and `"nur Sg."` in checks.
> 2. Put German-containing grammar explanations in `note` (shown after answering & in dictionary), **never** in `hint` (shown before answering).

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
4. Add `./data/lesson_XX.js` to `PRECACHE_URLS` and bump `CACHE_VERSION` (`deutschkarte-v9`, `deutschkarte-v10`, ...) in `sw.js`.
5. Update `PROJECT_CONTEXT.md` (+ **Changelog**), run `node --check`, verify zero raw note files, personal info, local paths, real emails, secrets, or `ALMANYA_HEDEF_PLANI.md` are staged/tracked, then `git add`, `git commit`, and `git push origin main`.

### Protocol 2: UI Changes & Feature Development
1. Follow `~/.gemini/config/skills/frontend-design/SKILL.md`: keep Prussian light/dark tokens, `--on-accent: #FFFFFF` for colored fills, `Bricolage Grotesque` + `Source Sans 3`, and crisp non-templated Turkish copy.
2. **Security & Privacy Gate:** Keep strict `script-src 'self'` CSP (zero inline scripts or `onclick`), `referrer="no-referrer"`, and `sync.js` Gist ID/origin/schema validation. Before committing, verify zero local paths, real emails, secrets/tokens, or `ALMANYA_HEDEF_PLANI.md` appear in tracked files.
3. **State & Sync Compatibility:** Preserve `deutschkarte_state_v1` schema backwards compatibility, `sync.js` merge/tombstone (`mistakeClearedAt`) and `resetAt` dominance (`saveState({ sync: true })` for learning state vs `{ sync: false, preserveTimestamp: true }` for view-only changes), and token isolation in `deutschkarte_gist_sync_v1`.
4. Update `sw.js` (`PRECACHE_URLS` + `CACHE_VERSION`), run `node --check` + unit/browser verification, update `PROJECT_CONTEXT.md`, and push to `main`.

---

## 5. Feature Backlog (Roadmap to A2–C1 / 300+ Words)

- **Long-term SRS:** Add `60 / 120 day` intervals, pure Due Review mode (`Tekrar Zamanı`), and mandatory typing gate for Boxes 4–5.
- **Grammar Expansion:** Add verb `Perfekt` (`hat/ist` + `Partizip II`) and `Präposition + Kasus` fields.
- **Cloze Mode:** Sentence fill-in-the-blank practice powered by `example.de`.

---

## 6. Changelog

- **2026-11-21 (`v1`–`v5`):** Initial release: A1 Lesson 1 (71 Duden-verified items + examples), 5-box Leitner SRS, `Artikel Pratiği`, bidirectional `TR / DE` & `DE / TR`, `de-DE` Web Speech pronunciation, Prussian-night dark mode, offline-first GitHub Gist sync (`sync.js`), `sw.js` `deutschkarte-v5`, deployed to `SohoTakuan/deutschkarte` GitHub Pages; personal Germany plan separated into `ALMANYA_HEDEF_PLANI.md`.
- **2026-11-21 (Security Hardening — `v6`):** Extracted inline scripts to `theme-init.js` and `boot-guard.js`, enforced strict `script-src 'self'` CSP and `no-referrer`, added Gist ID/origin/schema validation in `sync.js`, hardened `.gitignore`, scrubbed local username path from git history, bumped `sw.js` to `deutschkarte-v6`.
- **2026-11-21 (Docs):** Converted `PROJECT_CONTEXT.md` (and local `ALMANYA_HEDEF_PLANI.md`) to concise English for improved agent accuracy.
- **2026-11-21 (Privacy Safeguard):** Extended `.gitignore` to ignore raw note folders (`ham_notlar/`) and non-icon images (`*.jpg`, `*.jpeg`, `*.heic`, `*.webp`, `*.png` with `!icons/*.png`), and added an explicit pre-commit privacy check to `Protocol 1`.
- **2026-11-22 (Hide / Restore Words — `v7`):** Added per-word **Gizle** (Study Card + Dictionary) and **Gizlenenler** restore filter with 1-tap `Geri al` undo toast, consistent active-word SRS/progress math, mobile dictionary action layout, JSON backup + Gist sync (`hiddenWords` / `hiddenRestoredAt` tombstones), and bumped `sw.js` to `deutschkarte-v7`.
- **2026-11-22 (Ders 2 & Çekim/Notlar — `v8`):** Added Duden-verified A1 Lesson 2 (`data/lesson_02.js`, 84 items, total 155 A1 items) and a new **Çekim ve Notlar** tab (`data/grammar.js`, 5 study note cards + tables including `arbeiten`/`antworten`/`finden`/`warten`, and interactive 13-verb choice/typing conjugation drill with rule tips and speech), bumping `sw.js` to `deutschkarte-v8`.
- **2026-11-22 (Referee Audit & Polish — `v9`):** Fixed 3 cross-tab DOM selector collisions (`.dir-btn`, `.filter-chip`, `.umlaut-btn`), fixed `evaluateTurkishAnswer()` trailing-space & comma-split bugs (`l2_60`, `l2_61`, `l2_67`), resolved `l1_43`/`l2_08` `"Anne"` prompt ambiguity + `"artiksiz"`/`"Afedersiniz"`/`sync.js` copy typos, added conjugation prompt/example TTS buttons, mistake weighting (3x), combined rule+case tips, `é`/`Sie` typing hints, responsive `760px` header + table wrapping + dark-mode `--accent-der` WCAG contrast, and bumped `sw.js` to `deutschkarte-v9` (`Response.error()` offline fallback).
- **2026-11-22 (Context-Aware Floating AI Tutor — `v10`):** Added mobile-friendly floating **Almanca Asistan** bubble (`#ai-fab`) + chat drawer/bottom-sheet (`#ai-drawer`, `ai-tutor.js`) with live screen-context injection across Çalış, Çekim, Ders Notları, and Sözlük tabs, local BYOK Gemini API storage (`deutschkarte_ai_tutor_v1` via `x-goog-api-key`, CSP `generativelanguage.googleapis.com`), safe DOM markdown-lite rendering, context-aware quick chips, 1-tap `Ekran bağlamını kopyala`, and bumped `sw.js` to `deutschkarte-v10`.
- **2026-11-22 (AI Keep-Open Preference & Security Hardening — `v11`):** Added `keepAiOpen` preference in İlerleme (`#keep-ai-open-toggle`; auto-closes AI drawer on next/skip card when off, keeps open when on), added optional `sessionStorage` tab-only API key mode (`#ai-session-only`), enforced printable-ASCII credential validation, `credentials: "omit"` + `cache: "no-store"` + `referrerPolicy: "no-referrer"` on all API/Gist fetches, 1500-char prompt cap + error redaction, 1 MB JSON import & Gist fetch caps + 20s Gist timeout, `Number.isFinite` + `dailyGoal` + `YYYY-MM-DD` deserialization hardening, tightened CSP (`img-src 'self'`, `frame-src 'none'`, `media-src 'none'`), `sw.js` `response.type === "basic"` guard, and bumped `sw.js` to `deutschkarte-v11`.
- **2026-11-22 (Gemini Model Fix — `v12`):** Removed the manual AI model dropdown and locked `ai-tutor.js` to `gemini-3.8-flash` (fixing the 404 for new API keys on `gemini-2.5-flash`), and bumped `sw.js` to `deutschkarte-v12`.
- **2026-11-22 (Gemini Fallback Chain — `v13`):** Added automatic Flash fallback (`gemini-3.8-flash` -> `gemini-3.6-flash` -> `gemini-3.5-flash-lite`) with 15s per-attempt timeout and session-sticky healthy model selection on `503`/timeout/rate-limit errors, and bumped `sw.js` to `deutschkarte-v13`.
- **2026-11-22 (AI Model Selector Restored — `v14`):** Restored the AI model dropdown in `#ai-settings-panel` with the 3 curated Gemini models (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`) while retaining automatic fallback on `503`/timeout, and bumped `sw.js` to `deutschkarte-v14`.
- **2026-11-22 (AI Prompt & Markdown Polish — `v15`):** Removed roleplay/persona fluff from `SYSTEM_INSTRUCTION`, added safe `*italic*` (`<em>`) rendering in `ai-tutor.js`, and bumped `sw.js` to `deutschkarte-v15`.
- **2026-11-22 (Disable Browser Auto-Translate — `v16`):** Added `translate="no"`, `class="notranslate"`, and `<meta name="google" content="notranslate">` in `index.html` to stop Chrome/Google Translate from translating German articles (`der`/`die`/`das`) and umlaut buttons, and bumped `sw.js` to `deutschkarte-v16`.
