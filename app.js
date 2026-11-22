import {
  ALL_WORDS,
  getLessonList,
  getLevelSummary,
  getWordsForLesson
} from "./data/index.js";
import {
  CONJUGATION_VERBS,
  GRAMMAR_NOTES,
  PRONOUN_SLOTS
} from "./data/grammar.js";
import {
  clearSyncConfig,
  loadSyncConfig,
  saveSyncConfig,
  SyncHttpError,
  syncWithGitHubGist
} from "./sync.js";
import { initAiTutor } from "./ai-tutor.js";

const STORAGE_KEY = "deutschkarte_state_v1";
const THEME_STORAGE_KEY = "deutschkarte_theme";
const VALID_MODES = ["mixed", "choice", "typing", "articles", "mistakes"];
const VALID_DIRECTIONS = ["tr-de", "de-tr"];
const VALID_THEMES = ["light", "dark"];
const VALID_DAILY_GOALS = [10, 20, 30, 50];
const SRS_INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 };
const DAY_MS = 24 * 60 * 60 * 1000;
const WORD_BY_ID = new Map(ALL_WORDS.map((word) => [word.id, word]));
let aiTutor = null;

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayDateKey() {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return getLocalDateKey(yesterday);
}

function normalizeDailyState(rawDaily) {
  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();
  if (!rawDaily || typeof rawDaily !== "object") {
    return {
      date: today,
      count: 0,
      streakDays: 0,
      lastCompletedDate: null
    };
  }

  const savedDate = typeof rawDaily.date === "string" ? rawDaily.date : today;
  const lastCompletedDate =
    typeof rawDaily.lastCompletedDate === "string"
      ? rawDaily.lastCompletedDate
      : null;

  const isSameDay = savedDate === today;
  const count = isSameDay ? Math.max(0, Math.floor(Number(rawDaily.count) || 0)) : 0;

  let streakDays = Math.max(0, Math.floor(Number(rawDaily.streakDays) || 0));
  if (lastCompletedDate !== today && lastCompletedDate !== yesterday) {
    streakDays = 0;
  }

  return {
    date: today,
    count,
    streakDays,
    lastCompletedDate
  };
}

function createDefaultState() {
  return {
    settings: {
      mode: "mixed",
      lesson: "all",
      direction: "tr-de",
      dailyGoal: 20,
      autoSpeak: false
    },
    progress: {
      totalAnswered: 0,
      totalCorrect: 0,
      bestStreak: 0
    },
    daily: normalizeDailyState(null),
    cards: {},
    mistakes: {},
    mistakeClearedAt: {},
    hiddenWords: {},
    hiddenRestoredAt: {},
    updatedAt: 0,
    resetAt: 0
  };
}

function sanitizeClearedAt(rawCleared) {
  const clean = {};
  if (!rawCleared || typeof rawCleared !== "object") {
    return clean;
  }
  for (const [id, ts] of Object.entries(rawCleared)) {
    if (!WORD_BY_ID.has(id)) {
      continue;
    }
    const num = Number(ts);
    if (Number.isFinite(num) && num > 0) {
      clean[id] = num;
    }
  }
  return clean;
}

function sanitizeHiddenState(rawHidden, rawRestored) {
  const hiddenRestoredAt = sanitizeClearedAt(rawRestored);
  const candidateHidden = sanitizeClearedAt(rawHidden);
  const hiddenWords = {};
  for (const [id, ts] of Object.entries(candidateHidden)) {
    if (ts > (hiddenRestoredAt[id] || 0)) {
      hiddenWords[id] = ts;
    }
  }
  return { hiddenWords, hiddenRestoredAt };
}

function sanitizeMistakes(rawMistakes) {
  const clean = {};
  if (!rawMistakes || typeof rawMistakes !== "object") {
    return clean;
  }
  for (const [id, entry] of Object.entries(rawMistakes)) {
    if (!WORD_BY_ID.has(id) || !entry || typeof entry !== "object") {
      continue;
    }
    const streak = Math.max(0, Math.min(1, Math.floor(Number(entry.streak) || 0)));
    const misses = Math.max(1, Math.floor(Number(entry.misses) || 1));
    const updatedAt = Number(entry.updatedAt) || Date.now();
    clean[id] = { streak, misses, updatedAt };
  }
  return clean;
}

function sanitizeCards(rawCards) {
  const clean = {};
  if (!rawCards || typeof rawCards !== "object") {
    return clean;
  }
  for (const [id, entry] of Object.entries(rawCards)) {
    if (!WORD_BY_ID.has(id) || !entry || typeof entry !== "object") {
      continue;
    }
    const box = Math.max(1, Math.min(5, Math.floor(Number(entry.box) || 1)));
    const seen = Math.max(0, Math.floor(Number(entry.seen) || 0));
    const correct = Math.min(seen, Math.max(0, Math.floor(Number(entry.correct) || 0)));
    const lastSeenAt = Number(entry.lastSeenAt) || 0;
    const nextReviewAt = Number(entry.nextReviewAt) || 0;
    clean[id] = { box, seen, correct, lastSeenAt, nextReviewAt };
  }
  return clean;
}

function loadState() {
  const defaults = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }

    const mode = VALID_MODES.includes(parsed.settings?.mode)
      ? parsed.settings.mode
      : "mixed";
    const lessons = getLessonList().map((l) => l.title);
    const lesson =
      parsed.settings?.lesson === "all" || lessons.includes(parsed.settings?.lesson)
        ? parsed.settings.lesson
        : "all";
    const direction = VALID_DIRECTIONS.includes(parsed.settings?.direction)
      ? parsed.settings.direction
      : "tr-de";
    const rawGoal = Number(parsed.settings?.dailyGoal);
    const dailyGoal = VALID_DAILY_GOALS.includes(rawGoal) ? rawGoal : 20;
    const autoSpeak = Boolean(parsed.settings?.autoSpeak);

    const totalAnswered = Math.max(0, Number(parsed.progress?.totalAnswered) || 0);
    const totalCorrect = Math.min(
      totalAnswered,
      Math.max(0, Number(parsed.progress?.totalCorrect) || 0)
    );
    const bestStreak = Math.max(0, Number(parsed.progress?.bestStreak) || 0);

    const { hiddenWords, hiddenRestoredAt } = sanitizeHiddenState(
      parsed.hiddenWords,
      parsed.hiddenRestoredAt
    );

    return {
      settings: { mode, lesson, direction, dailyGoal, autoSpeak },
      progress: { totalAnswered, totalCorrect, bestStreak },
      daily: normalizeDailyState(parsed.daily),
      cards: sanitizeCards(parsed.cards),
      mistakes: sanitizeMistakes(parsed.mistakes),
      mistakeClearedAt: sanitizeClearedAt(parsed.mistakeClearedAt),
      hiddenWords,
      hiddenRestoredAt,
      updatedAt: Math.max(0, Number(parsed.updatedAt) || 0),
      resetAt: Math.max(0, Number(parsed.resetAt) || 0)
    };
  } catch {
    return defaults;
  }
}

let syncDebounceTimer = null;
let syncInFlight = false;

function saveState({ sync = false, preserveTimestamp = false } = {}) {
  if (!preserveTimestamp) {
    appState.updatedAt = Date.now();
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch {
    // Ignore storage quota errors silently
  }
  if (sync) {
    scheduleBackgroundSync();
  }
}

let appState = loadState();

const runtime = {
  activeTab: "study",
  sessionAnswered: 0,
  sessionCorrect: 0,
  sessionStreak: 0,
  currentWord: null,
  currentQuestionType: "typing",
  currentDirection: "tr-de",
  currentOptions: [],
  answered: false,
  selectedArticle: null,
  lastWordId: null,
  umlautUpper: false,
  lastFocusedInput: null,
  dictFilter: "all",
  dictLesson: "all",
  dictQuery: "",
  grammarSubTab: "drill",
  grammarInitialized: false,
  grammarNotesRendered: false,
  conjGroup: "all",
  conjMode: "choice",
  conjCurrent: null,
  conjLastPairKey: "",
  conjAnswered: false,
  conjScore: 0,
  conjAnsweredCount: 0,
  conjStreak: 0,
  conjMistakes: {}
};

const els = {
  tabStudy: document.getElementById("tab-study"),
  tabGrammar: document.getElementById("tab-grammar"),
  tabDictionary: document.getElementById("tab-dictionary"),
  studyView: document.getElementById("study-view"),
  grammarView: document.getElementById("grammar-view"),
  dictionaryView: document.getElementById("dictionary-view"),
  grammarSubDrill: document.getElementById("grammar-sub-drill"),
  grammarSubNotes: document.getElementById("grammar-sub-notes"),
  grammarDrillPanel: document.getElementById("grammar-drill-panel"),
  grammarNotesPanel: document.getElementById("grammar-notes-panel"),
  grammarGroupChips: Array.from(
    document.querySelectorAll("#grammar-group-filters .filter-chip")
  ),
  conjModeBtns: Array.from(document.querySelectorAll(".conj-mode-btn")),
  conjScore: document.getElementById("conj-score"),
  conjStreak: document.getElementById("conj-streak"),
  conjReset: document.getElementById("conj-reset"),
  conjCard: document.getElementById("conj-card"),
  conjGroupLabel: document.getElementById("conj-group-label"),
  conjInfinitiveMeaning: document.getElementById("conj-infinitive-meaning"),
  conjPronoun: document.getElementById("conj-pronoun"),
  conjVerb: document.getElementById("conj-verb"),
  conjSpeakPrompt: document.getElementById("conj-speak-prompt"),
  conjTrCue: document.getElementById("conj-tr-cue"),
  conjChoiceArea: document.getElementById("conj-choice-area"),
  conjChoiceList: document.getElementById("conj-choice-list"),
  conjChoiceActions: document.getElementById("conj-choice-actions"),
  conjSkipChoice: document.getElementById("conj-skip-choice"),
  conjTypingArea: document.getElementById("conj-typing-area"),
  conjInput: document.getElementById("conj-input"),
  conjUmlautBar: document.getElementById("conj-umlaut-bar"),
  conjUmlautBtns: Array.from(document.querySelectorAll(".conj-umlaut-btn")),
  conjInputGuidance: document.getElementById("conj-input-guidance"),
  conjTypingActions: document.getElementById("conj-typing-actions"),
  conjCheck: document.getElementById("conj-check"),
  conjSkipTyping: document.getElementById("conj-skip-typing"),
  conjFeedbackArea: document.getElementById("conj-feedback-area"),
  conjFeedbackBanner: document.getElementById("conj-feedback-banner"),
  conjRuleTip: document.getElementById("conj-rule-tip"),
  conjPrincipalParts: document.getElementById("conj-principal-parts"),
  conjMiniTable: document.getElementById("conj-mini-table"),
  conjExample: document.getElementById("conj-example"),
  conjExampleDe: document.getElementById("conj-example-de"),
  conjExampleTr: document.getElementById("conj-example-tr"),
  conjSpeakExample: document.getElementById("conj-speak-example"),
  conjNext: document.getElementById("conj-next"),
  conjSpeak: document.getElementById("conj-speak"),
  grammarNotesList: document.getElementById("grammar-notes-list"),
  modeBtns: Array.from(document.querySelectorAll(".mode-btn")),
  mistakesBadge: document.getElementById("mistakes-badge"),
  directionGroup: document.getElementById("direction-group"),
  dirBtns: Array.from(document.querySelectorAll("#direction-group .dir-btn")),
  lessonSelect: document.getElementById("lesson-select"),
  dailyProgress: document.getElementById("daily-progress"),
  masteredCount: document.getElementById("mastered-count"),
  sessionScore: document.getElementById("session-score"),
  sessionStreak: document.getElementById("session-streak"),
  resetSession: document.getElementById("reset-session"),

  studyCard: document.getElementById("study-card"),
  cardActiveBody: document.getElementById("card-active-body"),
  cardEmptyState: document.getElementById("card-empty-state"),
  emptyTitle: document.getElementById("empty-title"),
  emptyDesc: document.getElementById("empty-desc"),
  emptySwitchMixed: document.getElementById("empty-switch-mixed"),
  emptyAllLessons: document.getElementById("empty-all-lessons"),
  emptyOpenHidden: document.getElementById("empty-open-hidden"),

  cardLessonLabel: document.getElementById("card-lesson-label"),
  cardKindLabel: document.getElementById("card-kind-label"),
  btnHideWord: document.getElementById("btn-hide-word"),
  promptTr: document.getElementById("prompt-tr"),
  promptHint: document.getElementById("prompt-hint"),
  btnSpeakPrompt: document.getElementById("btn-speak-prompt"),

  typingArea: document.getElementById("typing-area"),
  nounFields: document.getElementById("noun-fields"),
  phraseFields: document.getElementById("phrase-fields"),
  inputPhraseLabel: document.getElementById("input-phrase-label"),
  articleBtns: Array.from(document.querySelectorAll(".article-btn")),
  inputSingular: document.getElementById("input-singular"),
  inputPlural: document.getElementById("input-plural"),
  inputPhrase: document.getElementById("input-phrase"),
  singularLockNote: document.getElementById("singular-lock-note"),
  pluralLockNote: document.getElementById("plural-lock-note"),
  umlautBar: document.getElementById("umlaut-bar"),
  umlautBtns: Array.from(document.querySelectorAll("#umlaut-bar .umlaut-btn")),
  toggleUmlautCase: document.getElementById("toggle-umlaut-case"),
  inputGuidance: document.getElementById("input-guidance"),
  typingActions: document.getElementById("typing-actions"),
  btnCheck: document.getElementById("btn-check"),
  btnSkip: document.getElementById("btn-skip"),

  choiceArea: document.getElementById("choice-area"),
  choiceList: document.getElementById("choice-list"),
  choiceActions: document.getElementById("choice-actions"),
  btnSkipChoice: document.getElementById("btn-skip-choice"),

  articleDrillArea: document.getElementById("article-drill-area"),
  articleDrillBtns: Array.from(document.querySelectorAll(".drill-btn")),
  articleDrillActions: document.getElementById("article-drill-actions"),
  btnSkipArticle: document.getElementById("btn-skip-article"),

  feedbackArea: document.getElementById("feedback-area"),
  feedbackBanner: document.getElementById("feedback-banner"),
  feedbackBreakdown: document.getElementById("feedback-breakdown"),
  feedbackTip: document.getElementById("feedback-tip"),
  feedbackNote: document.getElementById("feedback-note"),
  feedbackExample: document.getElementById("feedback-example"),
  feedbackExampleDe: document.getElementById("feedback-example-de"),
  feedbackExampleTr: document.getElementById("feedback-example-tr"),
  btnSpeakExample: document.getElementById("btn-speak-example"),
  feedbackMistakeStatus: document.getElementById("feedback-mistake-status"),
  btnNext: document.getElementById("btn-next"),
  btnSpeakAnswer: document.getElementById("btn-speak-answer"),

  dictSearch: document.getElementById("dict-search"),
  dictLessonSelect: document.getElementById("dict-lesson-select"),
  dictFilterChips: Array.from(
    document.querySelectorAll("#dictionary-view .filter-chip")
  ),
  dictHiddenBadge: document.getElementById("dict-hidden-badge"),
  dictCount: document.getElementById("dict-count"),
  dictList: document.getElementById("dict-list"),
  dictEmpty: document.getElementById("dict-empty"),
  dictEmptyText: document.getElementById("dict-empty-text"),
  dictClearFilters: document.getElementById("dict-clear-filters"),

  openBackup: document.getElementById("open-backup"),
  toggleTheme: document.getElementById("toggle-theme"),
  themeToggleLabel: document.getElementById("theme-toggle-label"),
  backupDialog: document.getElementById("backup-dialog"),
  closeBackup: document.getElementById("close-backup"),
  statLearned: document.getElementById("stat-learned"),
  statDailyStreak: document.getElementById("stat-daily-streak"),
  statTotal: document.getElementById("stat-total"),
  statAccuracy: document.getElementById("stat-accuracy"),
  statBestStreak: document.getElementById("stat-best-streak"),
  statMistakes: document.getElementById("stat-mistakes"),
  srsSummary: document.getElementById("srs-summary"),
  levelProgressList: document.getElementById("level-progress-list"),
  dailyGoalSelect: document.getElementById("daily-goal-select"),
  autoSpeakToggle: document.getElementById("auto-speak-toggle"),
  btnExportJson: document.getElementById("btn-export-json"),
  btnImportJson: document.getElementById("btn-import-json"),
  inputImportJson: document.getElementById("input-import-json"),
  backupStatus: document.getElementById("backup-status"),
  syncMeta: document.getElementById("sync-meta"),
  syncDisconnected: document.getElementById("sync-disconnected"),
  syncConnected: document.getElementById("sync-connected"),
  syncConnectedInfo: document.getElementById("sync-connected-info"),
  gistTokenInput: document.getElementById("gist-token-input"),
  btnSyncConnect: document.getElementById("btn-sync-connect"),
  btnSyncNow: document.getElementById("btn-sync-now"),
  btnSyncDisconnect: document.getElementById("btn-sync-disconnect"),
  syncStatus: document.getElementById("sync-status"),
  resetInitialRow: document.getElementById("reset-initial-row"),
  resetConfirmRow: document.getElementById("reset-confirm-row"),
  btnResetAsk: document.getElementById("btn-reset-ask"),
  btnResetConfirm: document.getElementById("btn-reset-confirm"),
  btnResetCancel: document.getElementById("btn-reset-cancel"),

  undoToast: document.getElementById("undo-toast"),
  undoToastText: document.getElementById("undo-toast-text"),
  btnUndoHide: document.getElementById("btn-undo-hide"),
  srAnnouncer: document.getElementById("sr-announcer")
};

/* Speech Synthesis (de-DE) */

let cachedGermanVoice = null;

function isSpeechSupported() {
  return (
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

function resolveGermanVoice() {
  if (!isSpeechSupported()) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }
  cachedGermanVoice =
    voices.find((v) => v.lang === "de-DE") ||
    voices.find((v) => v.lang.toLowerCase().startsWith("de")) ||
    null;
  return cachedGermanVoice;
}

function speakGerman(text) {
  if (!isSpeechSupported() || !text) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = 0.92;
    const voice = cachedGermanVoice || resolveGermanVoice();
    if (voice) {
      utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on restricted browsers
  }
}

function getSpokenGermanForWord(word, includeArticle = true) {
  if (!word) {
    return "";
  }
  if (word.category !== "noun") {
    return word.de;
  }
  if (!includeArticle) {
    return word.onlyPlural ? toArray(word.plural)[0] : toArray(word.singular)[0];
  }
  if (word.onlyPlural) {
    return `die ${toArray(word.plural)[0]}`;
  }
  if (word.onlySingular) {
    return `${word.article} ${toArray(word.singular)[0]}`;
  }
  return `${word.article} ${toArray(word.singular)[0]}, die ${toArray(word.plural)[0]}`;
}

/* Helpers */

function toArray(value) {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function collapseSpaces(str) {
  return String(str || "").trim().replace(/\s+/g, " ");
}

function normalizeApostrophes(str) {
  return str.replace(/[’`´]/g, "'");
}

function normalizeSearchText(str) {
  return String(str || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatGermanVariants(article, forms) {
  const arr = toArray(forms);
  if (arr.length === 0) {
    return "";
  }
  if (!article) {
    return arr.join(" / ");
  }
  return arr.map((item) => `${article} ${item}`).join(" / ");
}

function formatNounSummary(word) {
  if (word.onlyPlural) {
    return `die ${toArray(word.plural).join(" / die ")} (nur Plural)`;
  }
  if (word.onlySingular) {
    return `${formatGermanVariants(word.article, word.singular)} (nur Singular)`;
  }
  const sg = formatGermanVariants(word.article, word.singular);
  const pl = formatGermanVariants("die", word.plural);
  return `${sg}, ${pl}`;
}

function formatNounChoicePrimary(word) {
  if (word.onlyPlural) {
    return `die ${toArray(word.plural)[0]} (nur Plural)`;
  }
  if (word.onlySingular) {
    return `${word.article} ${toArray(word.singular)[0]} (nur Singular)`;
  }
  return `${word.article} ${toArray(word.singular)[0]}, die ${toArray(word.plural)[0]}`;
}

function getKindLabel(word) {
  if (word.category === "noun") {
    return "İsim";
  }
  if (word.category === "verb") {
    return "Fiil";
  }
  return "Kalıp";
}

function getWordSrsStatus(wordId) {
  const card = appState.cards[wordId];
  if (!card || !card.seen) {
    return { key: "new", label: "Yeni" };
  }
  if (card.box >= 4) {
    return { key: "learned", label: "Öğrenildi" };
  }
  if (card.nextReviewAt <= Date.now()) {
    return { key: "due", label: "Tekrar" };
  }
  return { key: "learning", label: "Öğreniliyor" };
}

function countMasteredWords(words = ALL_WORDS) {
  let count = 0;
  for (const word of words) {
    if ((appState.cards[word.id]?.box || 0) >= 4) {
      count += 1;
    }
  }
  return count;
}

function announce(message) {
  els.srAnnouncer.textContent = "";
  window.setTimeout(() => {
    els.srAnnouncer.textContent = message;
  }, 30);
}

/* Hidden Word Management & Undo Toast */

function isWordHidden(wordId) {
  return Boolean(appState.hiddenWords[wordId]);
}

function getActiveWords(words = ALL_WORDS) {
  return words.filter((word) => !appState.hiddenWords[word.id]);
}

function getActiveMistakeCount() {
  return Object.keys(appState.mistakes).filter(
    (id) => !appState.hiddenWords[id]
  ).length;
}

function getHiddenCount() {
  return Object.keys(appState.hiddenWords).length;
}

function getWordShortLabel(word) {
  if (!word) {
    return "";
  }
  if (word.category !== "noun") {
    return word.de;
  }
  if (word.onlyPlural) {
    return `die ${toArray(word.plural)[0]}`;
  }
  return `${word.article} ${toArray(word.singular)[0]}`;
}

let undoToastTimer = null;
let lastHiddenWordId = null;

function hideUndoToast() {
  if (undoToastTimer) {
    window.clearTimeout(undoToastTimer);
    undoToastTimer = null;
  }
  lastHiddenWordId = null;
  if (els.undoToast) {
    els.undoToast.hidden = true;
  }
}

function showUndoToast(word) {
  if (!els.undoToast || !els.undoToastText || !word) {
    return;
  }
  if (undoToastTimer) {
    window.clearTimeout(undoToastTimer);
  }
  lastHiddenWordId = word.id;
  els.undoToastText.textContent = `"${getWordShortLabel(word)}" gizlendi.`;
  els.undoToast.hidden = false;
  undoToastTimer = window.setTimeout(() => {
    hideUndoToast();
  }, 6000);
}

function hideWord(wordId, { fromCard = false } = {}) {
  if (!WORD_BY_ID.has(wordId)) {
    return;
  }
  const now = Math.max(Date.now(), (appState.hiddenRestoredAt[wordId] || 0) + 1);
  appState.hiddenWords[wordId] = now;
  saveState({ sync: true });
  populateLessonSelects();
  updateTopControls();

  const word = WORD_BY_ID.get(wordId);
  showUndoToast(word);
  announce(`"${getWordShortLabel(word)}" çalışma listesinden gizlendi.`);

  if (fromCard || runtime.currentWord?.id === wordId) {
    showNextCard();
  }
  if (runtime.activeTab === "dictionary") {
    renderDictionary();
  }
  if (els.backupDialog?.open) {
    refreshBackupModal();
  }
}

function unhideWord(wordId, { fromUndo = false } = {}) {
  if (!WORD_BY_ID.has(wordId)) {
    return;
  }
  const now = Math.max(Date.now(), (appState.hiddenWords[wordId] || 0) + 1);
  delete appState.hiddenWords[wordId];
  appState.hiddenRestoredAt[wordId] = now;
  saveState({ sync: true });

  if (lastHiddenWordId === wordId) {
    hideUndoToast();
  }
  populateLessonSelects();
  updateTopControls();

  if (runtime.currentWord === null || (fromUndo && runtime.activeTab === "study")) {
    showNextCard();
  }
  if (runtime.activeTab === "dictionary") {
    renderDictionary();
  }
  if (els.backupDialog?.open) {
    refreshBackupModal();
  }

  const word = WORD_BY_ID.get(wordId);
  announce(`"${getWordShortLabel(word)}" tekrar çalışma listesine eklendi.`);
}

/* Lesson Selectors & Top UI */

function populateLessonSelects() {
  const lessons = getLessonList();
  const selects = [els.lessonSelect, els.dictLessonSelect];
  const activeTotal = getActiveWords().length;

  for (const select of selects) {
    select.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = `Tüm Dersler (${activeTotal})`;
    select.appendChild(allOpt);

    const byLevel = new Map();
    for (const lesson of lessons) {
      if (!byLevel.has(lesson.level)) {
        byLevel.set(lesson.level, []);
      }
      byLevel.get(lesson.level).push(lesson);
    }

    for (const [level, group] of byLevel.entries()) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = `${level} Seviyesi`;
      for (const lesson of group) {
        const activeLessonCount = getWordsForLesson(lesson.id).filter(
          (w) => !isWordHidden(w.id)
        ).length;
        const opt = document.createElement("option");
        opt.value = lesson.title;
        opt.textContent = `${lesson.title} (${activeLessonCount})`;
        optgroup.appendChild(opt);
      }
      select.appendChild(optgroup);
    }
  }

  els.lessonSelect.value = appState.settings.lesson;
  els.dictLessonSelect.value = runtime.dictLesson;
}

function updateTopControls() {
  appState.daily = normalizeDailyState(appState.daily);

  const mistakeCount = getActiveMistakeCount();
  els.mistakesBadge.textContent = String(mistakeCount);
  els.mistakesBadge.hidden = mistakeCount === 0;

  if (els.dictHiddenBadge) {
    const hiddenCount = getHiddenCount();
    els.dictHiddenBadge.textContent = String(hiddenCount);
    els.dictHiddenBadge.hidden = hiddenCount === 0;
  }

  for (const btn of els.modeBtns) {
    btn.classList.toggle("is-active", btn.dataset.mode === appState.settings.mode);
  }

  const isArticlesMode = appState.settings.mode === "articles";
  els.directionGroup.classList.toggle("is-locked", isArticlesMode);
  for (const btn of els.dirBtns) {
    const isActive = btn.dataset.dir === appState.settings.direction;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
    btn.disabled = isArticlesMode;
  }

  const activeWords = getActiveWords();
  els.lessonSelect.value = appState.settings.lesson;
  els.dailyProgress.textContent = `${appState.daily.count} / ${appState.settings.dailyGoal}`;
  els.masteredCount.textContent = `${countMasteredWords(activeWords)} / ${activeWords.length}`;
  els.sessionScore.textContent = `${runtime.sessionCorrect} / ${runtime.sessionAnswered}`;
  els.sessionStreak.textContent = String(runtime.sessionStreak);
}

/* Pool & Leitner Weighted Scheduling */

function getActiveStudyPool() {
  const lessonWords = getWordsForLesson(appState.settings.lesson).filter(
    (word) => !isWordHidden(word.id)
  );
  if (appState.settings.mode === "mistakes") {
    return lessonWords.filter((word) => Boolean(appState.mistakes[word.id]));
  }
  if (appState.settings.mode === "articles") {
    return lessonWords.filter((word) => word.category === "noun");
  }
  return lessonWords;
}

function pickNextWord(pool) {
  if (pool.length === 0) {
    return null;
  }
  if (pool.length === 1) {
    return pool[0];
  }

  const now = Date.now();
  const candidates = pool.filter((word) => word.id !== runtime.lastWordId);
  const weightedList = candidates.length > 0 ? candidates : pool;

  const weights = weightedList.map((word) => {
    const mistake = appState.mistakes[word.id];
    if (mistake) {
      return 8 + Math.min(4, mistake.misses);
    }
    const card = appState.cards[word.id];
    if (!card || !card.seen) {
      return 4;
    }
    if (card.nextReviewAt <= now) {
      return 6;
    }
    if (card.box <= 3) {
      return 1.5;
    }
    return 0.4;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let target = Math.random() * totalWeight;
  for (let i = 0; i < weightedList.length; i += 1) {
    target -= weights[i];
    if (target <= 0) {
      return weightedList[i];
    }
  }
  return weightedList[weightedList.length - 1];
}

function decideQuestionType() {
  if (appState.settings.mode === "articles") {
    return "articles";
  }
  if (appState.settings.mode === "choice") {
    return "choice";
  }
  if (appState.settings.mode === "typing") {
    return "typing";
  }
  return Math.random() < 0.45 ? "choice" : "typing";
}

/* Multiple Choice Builder */

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildNounPluralTraps(singular, actualPlurals) {
  const traps = [];
  if (!singular) {
    return traps;
  }
  const actualSet = new Set(actualPlurals);

  if (/[aeou]$/i.test(singular)) {
    traps.push(`${singular}en`, `${singular}n`, singular);
  } else if (/(er|el|en)$/i.test(singular)) {
    traps.push(`${singular}n`, `${singular}e`, `${singular}s`);
  } else if (/y$/i.test(singular)) {
    traps.push(`${singular.slice(0, -1)}ies`, `${singular}en`, `${singular}e`);
  } else {
    traps.push(`${singular}en`, `${singular}s`, `${singular}e`, `${singular}er`);
  }

  for (const pl of actualPlurals) {
    const withoutUmlaut = pl
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/Ä/g, "A")
      .replace(/Ö/g, "O")
      .replace(/Ü/g, "U");
    if (withoutUmlaut !== pl) {
      traps.unshift(withoutUmlaut);
    }
  }

  return traps.filter((candidate) => !actualSet.has(candidate));
}

function prioritizeActivePools(...pools) {
  const activeParts = pools.map((list) =>
    shuffleArray(list.filter((item) => !isWordHidden(item.id)))
  );
  const hiddenParts = pools.map((list) =>
    shuffleArray(list.filter((item) => isWordHidden(item.id)))
  );
  return [...activeParts.flat(), ...hiddenParts.flat()];
}

function buildChoiceOptions(word, direction) {
  const options = [];
  const seenLabels = new Set();

  function addOption(label, isCorrect) {
    if (!label || seenLabels.has(label)) {
      return false;
    }
    seenLabels.add(label);
    options.push({ label, isCorrect });
    return true;
  }

  if (direction === "de-tr") {
    addOption(word.tr, true);

    const sameCategory = ALL_WORDS.filter(
      (item) =>
        item.id !== word.id &&
        item.category === word.category &&
        item.tr !== word.tr
    );
    const otherWords = ALL_WORDS.filter(
      (item) =>
        item.id !== word.id &&
        item.category !== word.category &&
        item.tr !== word.tr
    );

    for (const candidate of prioritizeActivePools(sameCategory, otherWords)) {
      if (options.length >= 4) {
        break;
      }
      addOption(candidate.tr, false);
    }

    return shuffleArray(options.slice(0, 4));
  }

  if (word.category === "noun") {
    const correctLabel = formatNounChoicePrimary(word);
    addOption(correctLabel, true);

    const sgMain = toArray(word.singular)[0];
    const plList = toArray(word.plural);
    const plMain = plList[0];

    if (word.onlyPlural) {
      addOption(`die ${plMain} (nur Singular)`, false);
      addOption(`der ${plMain}, die ${plMain}`, false);
      addOption(`das ${plMain}, die ${plMain}s`, false);
    } else if (word.onlySingular) {
      const otherArticles = ["der", "die", "das"].filter((a) => a !== word.article);
      for (const art of otherArticles) {
        addOption(`${art} ${sgMain} (nur Singular)`, false);
      }
      addOption(`${word.article} ${sgMain}, die ${sgMain}s`, false);
    } else {
      const otherArticles = shuffleArray(
        ["der", "die", "das"].filter((a) => a !== word.article)
      );
      addOption(`${otherArticles[0]} ${sgMain}, die ${plMain}`, false);

      const trapPlurals = buildNounPluralTraps(sgMain, plList);
      if (trapPlurals.length > 0) {
        addOption(`${word.article} ${sgMain}, die ${trapPlurals[0]}`, false);
      }
      if (otherArticles[1]) {
        addOption(`${otherArticles[1]} ${sgMain}, die ${plMain}`, false);
      }
    }

    const otherNouns = ALL_WORDS.filter(
      (item) =>
        item.category === "noun" &&
        item.id !== word.id &&
        item.tr !== word.tr
    );
    for (const candidate of prioritizeActivePools(otherNouns)) {
      if (options.length >= 4) {
        break;
      }
      addOption(formatNounChoicePrimary(candidate), false);
    }
  } else {
    const forbidden = new Set([word.de, ...toArray(word.alt)]);
    addOption(word.de, true);

    const hasPhraseOverlap = (item) =>
      [item.de, ...toArray(item.alt)].some((form) => forbidden.has(form));

    const sameCategory = ALL_WORDS.filter(
      (item) =>
        item.id !== word.id &&
        item.category === word.category &&
        item.tr !== word.tr &&
        !hasPhraseOverlap(item)
    );
    const fallbackPool = ALL_WORDS.filter(
      (item) =>
        item.id !== word.id &&
        item.category !== "noun" &&
        item.category !== word.category &&
        item.tr !== word.tr &&
        !hasPhraseOverlap(item)
    );
    for (const candidate of prioritizeActivePools(sameCategory, fallbackPool)) {
      if (options.length >= 4) {
        break;
      }
      addOption(candidate.de, false);
    }
  }

  return shuffleArray(options.slice(0, 4));
}

/* Card Rendering */

function showNextCard() {
  const pool = getActiveStudyPool();
  updateTopControls();

  if (pool.length === 0) {
    const lessonAllWords = getWordsForLesson(appState.settings.lesson);
    const hiddenInLesson = lessonAllWords.filter((w) => isWordHidden(w.id)).length;

    runtime.currentWord = null;
    els.cardActiveBody.hidden = true;
    els.cardEmptyState.hidden = false;
    els.studyCard.dataset.gender = "neutral";
    els.emptyOpenHidden.hidden = true;

    if (appState.settings.mode === "mistakes") {
      els.emptyTitle.textContent = "Zorlandığınız kelime yok";
      els.emptyDesc.textContent =
        appState.settings.lesson === "all"
          ? "Yanlış yaptığınız kelimeler burada toplanır ve art arda iki kez doğru bilene kadar sıkça karşınıza çıkar."
          : `${appState.settings.lesson} içinde zorlandığınız kelime kalmadı.`;
      els.emptySwitchMixed.hidden = false;
      els.emptyAllLessons.hidden = appState.settings.lesson === "all";
    } else if (appState.settings.mode === "articles") {
      const hasAnyNounInLesson = lessonAllWords.some(
        (w) => w.category === "noun"
      );
      els.emptyTitle.textContent = "Artikel sorusu bulunamadı";
      els.emptyDesc.textContent = hasAnyNounInLesson
        ? "Bu dersteki tüm isimler gizlenmiş. Gizlenenler bölümünden tekrar çalışmaya alabilirsiniz."
        : "Bu derste artikel pratiği için isim kaydı yer almıyor.";
      els.emptySwitchMixed.hidden = false;
      els.emptyAllLessons.hidden = appState.settings.lesson === "all";
      els.emptyOpenHidden.hidden = !hasAnyNounInLesson;
    } else if (hiddenInLesson > 0 && hiddenInLesson === lessonAllWords.length) {
      els.emptyTitle.textContent =
        appState.settings.lesson === "all"
          ? "Tüm kelimeler gizlendi"
          : "Bu dersteki tüm kelimeler gizlendi";
      els.emptyDesc.textContent =
        "Kelime Sözlüğü'ndeki Gizlenenler filtresinden istediğiniz kelimeleri tekrar çalışmaya alabilirsiniz.";
      els.emptySwitchMixed.hidden = true;
      els.emptyAllLessons.hidden = appState.settings.lesson === "all";
      els.emptyOpenHidden.hidden = false;
    } else {
      els.emptyTitle.textContent = "Bu derste kelime bulunamadı";
      els.emptyDesc.textContent = "Farklı bir ders seçerek çalışmaya devam edebilirsiniz.";
      els.emptySwitchMixed.hidden = true;
      els.emptyAllLessons.hidden = false;
    }
    return;
  }

  els.cardEmptyState.hidden = true;
  els.cardActiveBody.hidden = false;

  const word = pickNextWord(pool);
  const questionType = decideQuestionType();
  const direction =
    questionType === "articles" ? "de-tr" : appState.settings.direction;

  runtime.currentWord = word;
  runtime.lastWordId = word.id;
  runtime.answered = false;
  runtime.selectedArticle = null;
  runtime.currentQuestionType = questionType;
  runtime.currentDirection = direction;
  runtime.currentOptions =
    questionType === "choice" ? buildChoiceOptions(word, direction) : [];

  els.studyCard.classList.remove("is-advancing");
  void els.studyCard.offsetWidth;
  els.studyCard.classList.add("is-advancing");

  els.cardLessonLabel.textContent = `${word.level}, ${word.lesson}`;
  els.cardKindLabel.textContent = getKindLabel(word);

  const speechReady = isSpeechSupported();

  if (questionType === "articles") {
    els.studyCard.dataset.gender = "neutral";
    els.promptTr.textContent = getSpokenGermanForWord(word, false);
    els.promptHint.textContent = word.tr;
    els.promptHint.hidden = false;
    els.btnSpeakPrompt.hidden = !speechReady;
  } else if (direction === "de-tr") {
    els.studyCard.dataset.gender =
      word.category === "noun" ? word.article : "resolved";
    els.promptTr.textContent =
      word.category === "noun" ? formatNounSummary(word) : word.de;
    if (word.hint) {
      els.promptHint.textContent = word.hint;
      els.promptHint.hidden = false;
    } else {
      els.promptHint.hidden = true;
      els.promptHint.textContent = "";
    }
    els.btnSpeakPrompt.hidden = !speechReady;
  } else {
    els.studyCard.dataset.gender = "neutral";
    els.promptTr.textContent = word.tr;
    if (word.hint) {
      els.promptHint.textContent = word.hint;
      els.promptHint.hidden = false;
    } else {
      els.promptHint.hidden = true;
      els.promptHint.textContent = "";
    }
    els.btnSpeakPrompt.hidden = true;
  }

  els.feedbackArea.hidden = true;
  els.inputGuidance.hidden = true;
  els.inputGuidance.textContent = "";

  if (questionType === "articles") {
    renderArticleDrillView();
  } else if (questionType === "choice") {
    renderChoiceView();
  } else {
    renderTypingView(word, direction);
  }
  aiTutor?.refreshContext();
}

function renderChoiceView() {
  els.typingArea.hidden = true;
  els.articleDrillArea.hidden = true;
  els.choiceArea.hidden = false;
  els.choiceActions.hidden = false;
  els.choiceList.innerHTML = "";

  runtime.currentOptions.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.dataset.index = String(index);

    const keySpan = document.createElement("span");
    keySpan.className = "choice-key";
    keySpan.textContent = String(index + 1);

    const textSpan = document.createElement("span");
    textSpan.textContent = option.label;

    btn.appendChild(keySpan);
    btn.appendChild(textSpan);
    btn.addEventListener("click", () => handleChoiceSelect(index));
    els.choiceList.appendChild(btn);
  });
}

function renderArticleDrillView() {
  els.typingArea.hidden = true;
  els.choiceArea.hidden = true;
  els.articleDrillArea.hidden = false;
  els.articleDrillActions.hidden = false;

  for (const btn of els.articleDrillBtns) {
    btn.disabled = false;
    btn.classList.remove("is-correct", "is-wrong");
  }
}

function renderTypingView(word, direction) {
  els.choiceArea.hidden = true;
  els.articleDrillArea.hidden = true;
  els.typingArea.hidden = false;
  els.typingActions.hidden = false;

  for (const btn of els.articleBtns) {
    btn.classList.remove("is-selected");
    btn.setAttribute("aria-pressed", "false");
    btn.disabled = false;
  }

  els.inputSingular.value = "";
  els.inputPlural.value = "";
  els.inputPhrase.value = "";
  els.inputSingular.disabled = false;
  els.inputPlural.disabled = false;
  els.inputPhrase.disabled = false;

  if (direction === "de-tr") {
    els.nounFields.hidden = true;
    els.phraseFields.hidden = false;
    els.umlautBar.hidden = true;
    els.inputPhraseLabel.textContent = "Türkçe anlamı";
    els.inputPhrase.placeholder = "Türkçe karşılığını yazın";
    runtime.lastFocusedInput = els.inputPhrase;
    if (!els.backupDialog.open && runtime.activeTab === "study") {
      window.setTimeout(() => {
        if (!els.backupDialog.open && runtime.activeTab === "study") {
          els.inputPhrase.focus();
        }
      }, 10);
    }
    return;
  }

  els.umlautBar.hidden = false;
  els.inputPhraseLabel.textContent = "Almanca karşılığı";
  els.inputPhrase.placeholder = "Almanca ifadeyi yazın";

  if (word.category === "noun") {
    els.nounFields.hidden = false;
    els.phraseFields.hidden = true;
    applyNounFieldLocks();
    runtime.lastFocusedInput = !els.inputSingular.disabled
      ? els.inputSingular
      : els.inputPlural;
    if (!els.backupDialog.open && runtime.activeTab === "study") {
      window.setTimeout(() => {
        if (!els.backupDialog.open && runtime.activeTab === "study") {
          const target = !els.inputSingular.disabled
            ? els.inputSingular
            : els.inputPlural;
          target.focus();
        }
      }, 10);
    }
  } else {
    els.nounFields.hidden = true;
    els.phraseFields.hidden = false;
    runtime.lastFocusedInput = els.inputPhrase;
    if (!els.backupDialog.open && runtime.activeTab === "study") {
      window.setTimeout(() => {
        if (!els.backupDialog.open && runtime.activeTab === "study") {
          els.inputPhrase.focus();
        }
      }, 10);
    }
  }
}

function applyNounFieldLocks() {
  const word = runtime.currentWord;
  if (!word || word.category !== "noun") {
    return;
  }

  const lockSingularByWord = Boolean(word.onlyPlural);
  const lockPluralByWord = Boolean(word.onlySingular);
  const lockSingularBySelection = runtime.selectedArticle === "nur Pl.";
  const lockPluralBySelection = runtime.selectedArticle === "nur Sg.";

  const disableSingular = lockSingularByWord || lockSingularBySelection;
  const disablePlural = lockPluralByWord || lockPluralBySelection;

  els.inputSingular.disabled = disableSingular;
  if (disableSingular) {
    els.inputSingular.value = "";
    els.singularLockNote.textContent = lockSingularByWord
      ? "Sadece çoğul kullanılır (Tekil biçimi yok)"
      : "nur Pl. seçildiği için tekil alanı kilitli";
    els.singularLockNote.hidden = false;
  } else {
    els.singularLockNote.hidden = true;
  }

  els.inputPlural.disabled = disablePlural;
  if (disablePlural) {
    els.inputPlural.value = "";
    els.pluralLockNote.textContent = lockPluralByWord
      ? "Sadece tekil kullanılır (Çoğul biçimi yok)"
      : "nur Sg. seçildiği için çoğul alanı kilitli";
    els.pluralLockNote.hidden = false;
  } else {
    els.pluralLockNote.hidden = true;
  }
}

/* Text Normalization & Validation */

function inspectAccidentalArticle(rawValue, expectedList, expectedArticle) {
  const match = rawValue.match(/^(der|die|das)\s+(.+)$/i);
  if (!match) {
    return {
      cleaned: rawValue,
      strippedArticleTip: false,
      conflictingArticle: null
    };
  }
  const expectedHasArticle = expectedList.some((item) =>
    /^(der|die|das)\s+/i.test(item)
  );
  if (expectedHasArticle) {
    return {
      cleaned: rawValue,
      strippedArticleTip: false,
      conflictingArticle: null
    };
  }
  const typedArticle = match[1].toLowerCase();
  const candidate = collapseSpaces(match[2]);
  if (expectedArticle && typedArticle === expectedArticle.toLowerCase()) {
    return {
      cleaned: candidate,
      strippedArticleTip: true,
      conflictingArticle: null
    };
  }
  return {
    cleaned: rawValue,
    strippedArticleTip: false,
    conflictingArticle: typedArticle
  };
}

function foldDiacritics(str) {
  return str
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/é/g, "e")
    .replace(/ß/g, "ss");
}

function detectSpecialCharTips(userText, expectedList) {
  const userLower = userText.toLowerCase();
  const userFolded = foldDiacritics(userText);

  let needsEszett = false;
  let needsUmlaut = false;

  for (const exp of expectedList) {
    if (foldDiacritics(exp) !== userFolded) {
      continue;
    }
    if (exp.includes("ß") && !userText.includes("ß")) {
      needsEszett = true;
    }
    const expWithoutEszett = exp.toLowerCase().replace(/ß/g, "ss");
    const userWithoutEszett = userLower.replace(/ß/g, "ss");
    if (expWithoutEszett !== userWithoutEszett) {
      needsUmlaut = true;
    }
  }

  return { needsEszett, needsUmlaut };
}

function checkNounCapitalization(candidate, expected) {
  if (candidate === expected) {
    return { hasLowercaseIssue: false, isAllCaps: false };
  }
  const allCaps =
    candidate.length > 1 &&
    candidate === candidate.toLocaleUpperCase("de-DE") &&
    expected !== expected.toLocaleUpperCase("de-DE");
  if (allCaps) {
    return { hasLowercaseIssue: false, isAllCaps: true };
  }
  for (let i = 0; i < expected.length; i += 1) {
    const expChar = expected[i];
    const gotChar = candidate[i];
    if (expChar !== expChar.toLowerCase() && gotChar === expChar.toLowerCase()) {
      return { hasLowercaseIssue: true, isAllCaps: false };
    }
  }
  return { hasLowercaseIssue: false, isAllCaps: false };
}

function evaluateGermanWord(rawInput, expectedValue, expectedArticle) {
  const expectedList = toArray(expectedValue);
  const trimmed = collapseSpaces(rawInput);

  if (!trimmed) {
    return {
      ok: false,
      userDisplay: "(Boş bırakıldı)",
      expectedDisplay: expectedList.join(" / "),
      lowercaseTip: false,
      allCapsTip: false,
      strippedArticleTip: false,
      conflictingArticle: null,
      umlautTip: false,
      eszettTip: false
    };
  }

  const articleInfo = inspectAccidentalArticle(
    trimmed,
    expectedList,
    expectedArticle
  );
  const candidate = articleInfo.cleaned;

  if (articleInfo.conflictingArticle) {
    return {
      ok: false,
      userDisplay: trimmed,
      expectedDisplay: expectedList.join(" / "),
      lowercaseTip: false,
      allCapsTip: false,
      strippedArticleTip: false,
      conflictingArticle: articleInfo.conflictingArticle,
      umlautTip: false,
      eszettTip: false
    };
  }

  for (const expected of expectedList) {
    if (candidate === expected) {
      return {
        ok: true,
        userDisplay: trimmed,
        expectedDisplay: expectedList.join(" / "),
        lowercaseTip: false,
        allCapsTip: false,
        strippedArticleTip: articleInfo.strippedArticleTip,
        conflictingArticle: null,
        umlautTip: false,
        eszettTip: false
      };
    }
  }

  for (const expected of expectedList) {
    if (candidate.toLowerCase() === expected.toLowerCase()) {
      const cap = checkNounCapitalization(candidate, expected);
      return {
        ok: true,
        userDisplay: trimmed,
        expectedDisplay: expectedList.join(" / "),
        lowercaseTip: cap.hasLowercaseIssue,
        allCapsTip: cap.isAllCaps,
        strippedArticleTip: articleInfo.strippedArticleTip,
        conflictingArticle: null,
        umlautTip: false,
        eszettTip: false
      };
    }
  }

  const charTips = detectSpecialCharTips(candidate, expectedList);
  return {
    ok: false,
    userDisplay: trimmed,
    expectedDisplay: expectedList.join(" / "),
    lowercaseTip: false,
    allCapsTip: false,
    strippedArticleTip: articleInfo.strippedArticleTip,
    conflictingArticle: null,
    umlautTip: charTips.needsUmlaut,
    eszettTip: charTips.needsEszett
  };
}

function classifyPhraseCaseTip(candidate, expected, word) {
  if (candidate === expected) {
    return null;
  }
  if (word.category === "verb") {
    return "İpucu: Almanca fiil mastarları küçük harfle yazılır.";
  }
  if (expected.includes("Ihnen") && /\bihnen\b/.test(candidate)) {
    return "İpucu: Resmi hitapta \"Ihnen\" kelimesi büyük harfle başlar.";
  }
  if (/\bSie\b/.test(expected) && /\bsie\b/.test(candidate)) {
    return "İpucu: Resmi hitapta \"Sie\" zamiri daima büyük harfle yazılır.";
  }
  const expTokens = expected.replace(/[,!?.'’]/g, " ").split(/\s+/);
  const gotTokens = candidate.replace(/[,!?.'’]/g, " ").split(/\s+/);
  for (let i = 0; i < expTokens.length; i += 1) {
    const eTok = expTokens[i];
    const gTok = gotTokens[i];
    if (
      eTok &&
      gTok &&
      eTok[0] !== eTok[0].toLowerCase() &&
      gTok[0] === eTok[0].toLowerCase()
    ) {
      return "İpucu: Almancada cümle başı ve isimler büyük harfle başlar.";
    }
  }
  return null;
}

function evaluatePhrase(rawInput, word) {
  const expectedList = [word.de, ...toArray(word.alt)];
  const clean = (s) =>
    normalizeApostrophes(collapseSpaces(s)).replace(/[.!?]+$/g, "").trim();
  const stripCommasAndApos = (s) =>
    s.replace(/,\s*/g, " ").replace(/'/g, "").replace(/\s+/g, " ").trim();

  const candidate = clean(rawInput);
  if (!candidate) {
    return { ok: false, caseTip: null, eszettTip: false, umlautTip: false };
  }

  for (const expected of expectedList) {
    const cleanExpected = clean(expected);
    if (candidate === cleanExpected) {
      return { ok: true, caseTip: null, eszettTip: false, umlautTip: false };
    }
  }

  for (const expected of expectedList) {
    const cleanExpected = clean(expected);
    if (candidate.toLowerCase() === cleanExpected.toLowerCase()) {
      return {
        ok: true,
        caseTip: classifyPhraseCaseTip(candidate, cleanExpected, word),
        eszettTip: false,
        umlautTip: false
      };
    }
    if (
      stripCommasAndApos(candidate).toLowerCase() ===
      stripCommasAndApos(cleanExpected).toLowerCase()
    ) {
      return {
        ok: true,
        caseTip: classifyPhraseCaseTip(candidate, cleanExpected, word),
        eszettTip: false,
        umlautTip: false
      };
    }
  }

  const cleanExpectedList = expectedList.map(clean);
  const charTips = detectSpecialCharTips(candidate, cleanExpectedList);
  return {
    ok: false,
    caseTip: null,
    eszettTip: charTips.needsEszett,
    umlautTip: charTips.needsEszett ? false : charTips.needsUmlaut
  };
}

function evaluateTurkishAnswer(rawInput, word) {
  const cleanTr = (s) =>
    collapseSpaces(s)
      .replace(/[.!?]+$/g, "")
      .trim()
      .toLocaleLowerCase("tr-TR");

  const candidate = cleanTr(rawInput);
  if (!candidate) {
    return { ok: false };
  }

  const base = word.tr;
  const accepted = new Set([cleanTr(base)]);

  const withoutParens = collapseSpaces(base.replace(/\([^)]*\)/g, ""));
  if (withoutParens) {
    accepted.add(cleanTr(withoutParens));
  }

  for (const part of withoutParens.split(/[\/,]/)) {
    const trimmedPart = cleanTr(part);
    if (trimmedPart) {
      accepted.add(trimmedPart);
    }
  }

  return { ok: accepted.has(candidate) };
}

/* Submission Handlers */

function handleTypingSubmit() {
  if (runtime.answered || !runtime.currentWord) {
    return;
  }

  const word = runtime.currentWord;
  els.inputGuidance.hidden = true;

  if (runtime.currentDirection === "de-tr") {
    const raw = collapseSpaces(els.inputPhrase.value);
    if (!raw) {
      els.inputGuidance.textContent =
        "Türkçe anlamını yazın veya \"Kartı atla\" ile sıradaki karta geçin.";
      els.inputGuidance.hidden = false;
      els.inputPhrase.focus();
      return;
    }

    const res = evaluateTurkishAnswer(raw, word);
    finalizeTurn(word, res.ok, {});
    return;
  }

  if (word.category === "noun") {
    const hasAnyInput =
      Boolean(runtime.selectedArticle) ||
      Boolean(collapseSpaces(els.inputSingular.value)) ||
      Boolean(collapseSpaces(els.inputPlural.value));

    if (!hasAnyInput) {
      els.inputGuidance.textContent =
        "Kontrol etmek için en azından bir artikel seçin veya kelimeyi yazın; bilmiyorsanız \"Kartı atla\" düğmesini kullanabilirsiniz.";
      els.inputGuidance.hidden = false;
      return;
    }

    let articleOk = false;
    let expectedArticleDisplay = word.article;

    if (word.onlySingular) {
      articleOk =
        runtime.selectedArticle === word.article ||
        runtime.selectedArticle === "nur Sg.";
      expectedArticleDisplay = `${word.article} (veya nur Sg.)`;
    } else if (word.onlyPlural) {
      articleOk = runtime.selectedArticle === "nur Pl.";
      expectedArticleDisplay = "nur Pl.";
    } else {
      articleOk = runtime.selectedArticle === word.article;
    }

    const singularResult = word.onlyPlural
      ? {
          na: true,
          ok: true,
          expectedDisplay: "Tekil yok (nur Plural)",
          userDisplay: ""
        }
      : {
          na: false,
          ...evaluateGermanWord(els.inputSingular.value, word.singular, word.article)
        };

    const pluralResult = word.onlySingular
      ? {
          na: true,
          ok: true,
          expectedDisplay: "Çoğul yok (nur Singular)",
          userDisplay: ""
        }
      : {
          na: false,
          ...evaluateGermanWord(els.inputPlural.value, word.plural, "die")
        };

    const allCorrect = articleOk && singularResult.ok && pluralResult.ok;

    const tips = [];
    if (singularResult.lowercaseTip || pluralResult.lowercaseTip) {
      tips.push("İpucu: Almanca isimler büyük harfle başlar.");
    } else if (singularResult.allCapsTip || pluralResult.allCapsTip) {
      tips.push("İpucu: Yalnızca kelimenin baş harfini büyük yazın.");
    }

    if (singularResult.conflictingArticle || pluralResult.conflictingArticle) {
      tips.push(
        "İpucu: Yazı alanının içine artikel eklemeyin; artikeli yalnızca üstteki düğmelerden seçin."
      );
    } else if (singularResult.strippedArticleTip || pluralResult.strippedArticleTip) {
      tips.push(
        runtime.selectedArticle
          ? "İpucu: Artikeli üstteki düğmelerden seçtiğiniz için yazı alanına yalnızca kelimenin kendisini yazmanız yeterlidir."
          : "İpucu: Artikeli yazı alanına değil, üstteki artikel düğmelerinden seçmelisiniz."
      );
    }

    if (singularResult.eszettTip || pluralResult.eszettTip) {
      tips.push("İpucu: Bu kelimede \"ss\" yerine \"ß\" harfi kullanılır.");
    }
    if (singularResult.umlautTip || pluralResult.umlautTip) {
      tips.push("İpucu: Umlaut ve aksan işaretlerine dikkat edin (ä, ö, ü, é).");
    }
    if (word.onlyPlural && runtime.selectedArticle === "die") {
      tips.push(
        "İpucu: Çoğul artikeli \"die\" olsa da sadece çoğul kullanılan isimlerde \"nur Pl.\" seçeneğini işaretleyin."
      );
    }

    finalizeTurn(word, allCorrect, {
      parts: [
        {
          label: "Artikel",
          ok: articleOk,
          na: false,
          expected: expectedArticleDisplay,
          user: runtime.selectedArticle || "(Seçilmedi)"
        },
        {
          label: "Tekil",
          ok: singularResult.ok,
          na: singularResult.na,
          expected: singularResult.expectedDisplay,
          user: singularResult.userDisplay
        },
        {
          label: "Çoğul",
          ok: pluralResult.ok,
          na: pluralResult.na,
          expected: pluralResult.expectedDisplay,
          user: pluralResult.userDisplay
        }
      ],
      tip: tips.join(" ")
    });
  } else {
    const raw = collapseSpaces(els.inputPhrase.value);
    if (!raw) {
      els.inputGuidance.textContent =
        "Almanca karşılığını yazın veya \"Kartı atla\" ile sıradaki karta geçin.";
      els.inputGuidance.hidden = false;
      els.inputPhrase.focus();
      return;
    }

    const res = evaluatePhrase(raw, word);
    const tips = [];
    if (res.caseTip) {
      tips.push(res.caseTip);
    }
    if (res.eszettTip) {
      tips.push("İpucu: Bu ifadede \"ss\" yerine \"ß\" harfi kullanılır.");
    }
    if (res.umlautTip) {
      tips.push("İpucu: Umlaut ve aksan işaretlerine dikkat edin (ä, ö, ü, é).");
    }

    finalizeTurn(word, res.ok, {
      altList: toArray(word.alt),
      tip: tips.join(" ")
    });
  }
}

function handleChoiceSelect(index) {
  if (runtime.answered || !runtime.currentWord) {
    return;
  }

  const chosen = runtime.currentOptions[index];
  if (!chosen) {
    return;
  }

  const optionButtons = Array.from(els.choiceList.querySelectorAll(".choice-btn"));
  optionButtons.forEach((btn, idx) => {
    btn.disabled = true;
    const opt = runtime.currentOptions[idx];
    if (opt.isCorrect) {
      btn.classList.add("is-correct");
    } else if (idx === index && !opt.isCorrect) {
      btn.classList.add("is-wrong");
    }
  });

  finalizeTurn(runtime.currentWord, chosen.isCorrect, {
    altList: toArray(runtime.currentWord.alt)
  });
}

function handleArticleDrillSelect(index) {
  if (runtime.answered || !runtime.currentWord) {
    return;
  }

  const btn = els.articleDrillBtns[index];
  if (!btn) {
    return;
  }

  const word = runtime.currentWord;
  const chosenArticle = btn.dataset.article;
  const expectedArticle = word.onlyPlural ? "nur Pl." : word.article;
  const isCorrect = chosenArticle === expectedArticle;

  for (const item of els.articleDrillBtns) {
    item.disabled = true;
    if (item.dataset.article === expectedArticle) {
      item.classList.add("is-correct");
    } else if (item === btn && !isCorrect) {
      item.classList.add("is-wrong");
    }
  }

  finalizeTurn(word, isCorrect, {});
}

function recordCardReview(wordId, isCorrect) {
  const now = Date.now();
  const prev = appState.cards[wordId] || {
    box: 1,
    seen: 0,
    correct: 0,
    lastSeenAt: 0,
    nextReviewAt: 0
  };

  const nextBox = isCorrect ? Math.min(5, prev.box + 1) : 1;
  const intervalDays = SRS_INTERVAL_DAYS[nextBox] ?? 0;

  appState.cards[wordId] = {
    box: nextBox,
    seen: prev.seen + 1,
    correct: prev.correct + (isCorrect ? 1 : 0),
    lastSeenAt: now,
    nextReviewAt: now + intervalDays * DAY_MS
  };

  appState.daily = normalizeDailyState(appState.daily);
  appState.daily.count += 1;

  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();
  if (
    appState.daily.count >= appState.settings.dailyGoal &&
    appState.daily.lastCompletedDate !== today
  ) {
    appState.daily.streakDays =
      appState.daily.lastCompletedDate === yesterday
        ? appState.daily.streakDays + 1
        : 1;
    appState.daily.lastCompletedDate = today;
  }
}

function finalizeTurn(word, isCorrect, details) {
  runtime.answered = true;
  runtime.sessionAnswered += 1;
  appState.progress.totalAnswered += 1;

  if (isCorrect) {
    runtime.sessionCorrect += 1;
    runtime.sessionStreak += 1;
    appState.progress.totalCorrect += 1;
    if (runtime.sessionStreak > appState.progress.bestStreak) {
      appState.progress.bestStreak = runtime.sessionStreak;
    }
  } else {
    runtime.sessionStreak = 0;
  }

  recordCardReview(word.id, isCorrect);

  let mistakeStatusText = "";
  const existingMistake = appState.mistakes[word.id];

  if (!isCorrect) {
    appState.mistakes[word.id] = {
      streak: 0,
      misses: (existingMistake?.misses || 0) + 1,
      updatedAt: Date.now()
    };
    mistakeStatusText =
      "Zorlandıklarım listesine eklendi (art arda 2 doğru cevapta listeden çıkar).";
  } else if (existingMistake) {
    const newStreak = existingMistake.streak + 1;
    if (newStreak >= 2) {
      delete appState.mistakes[word.id];
      appState.mistakeClearedAt[word.id] = Date.now();
      mistakeStatusText =
        "Art arda 2 kez doğru bildiniz. Zorlandıklarım listesinden çıkarıldı.";
    } else {
      appState.mistakes[word.id] = {
        ...existingMistake,
        streak: newStreak,
        updatedAt: Date.now()
      };
      mistakeStatusText =
        "Zorlandıklarım ilerlemesi: 1 / 2 doğru (1 doğru daha gerekir).";
    }
  }

  saveState({ sync: true });
  updateTopControls();

  if (runtime.currentQuestionType === "typing") {
    for (const btn of els.articleBtns) {
      btn.disabled = true;
    }
    els.inputSingular.disabled = true;
    els.inputPlural.disabled = true;
    els.inputPhrase.disabled = true;
    els.umlautBar.hidden = true;
    els.typingActions.hidden = true;
  } else if (runtime.currentQuestionType === "articles") {
    els.articleDrillActions.hidden = true;
  } else {
    els.choiceActions.hidden = true;
  }

  if (word.category === "noun") {
    els.studyCard.dataset.gender = word.article;
  } else {
    els.studyCard.dataset.gender = "resolved";
  }

  renderFeedback(word, isCorrect, details, mistakeStatusText);
  if (appState.settings.autoSpeak) {
    speakGerman(getSpokenGermanForWord(word, true));
  }
  if (runtime.activeTab === "dictionary") {
    renderDictionary();
  }
  aiTutor?.refreshContext();
}

function renderFeedback(word, isCorrect, details, mistakeStatusText) {
  els.feedbackArea.hidden = false;
  els.feedbackBanner.className = `feedback-banner ${isCorrect ? "is-correct" : "is-wrong"}`;

  if (runtime.currentDirection === "de-tr" && runtime.currentQuestionType !== "articles") {
    els.feedbackBanner.textContent = isCorrect
      ? `Doğru: ${word.tr}`
      : `Yanlış. Doğru cevap: ${word.tr}`;
  } else if (word.category === "noun") {
    const summary = formatNounSummary(word);
    els.feedbackBanner.textContent = isCorrect
      ? `Doğru: ${summary}`
      : `Yanlış. Doğru cevap: ${summary}`;
  } else {
    const altText =
      details.altList && details.altList.length > 0
        ? ` (Diğer kabul edilenler: ${details.altList.join(" / ")})`
        : "";
    els.feedbackBanner.textContent = isCorrect
      ? `Doğru: ${word.de}${altText}`
      : `Yanlış. Doğru cevap: ${word.de}${altText}`;
  }

  if (details.parts && details.parts.length > 0) {
    els.feedbackBreakdown.innerHTML = "";
    for (const part of details.parts) {
      const box = document.createElement("div");
      const statusClass = part.na ? "is-na" : part.ok ? "is-ok" : "is-bad";
      box.className = `part-card ${statusClass}`;

      const labelEl = document.createElement("span");
      labelEl.className = "part-label";
      labelEl.textContent = part.na
        ? part.label
        : `${part.label} (${part.ok ? "Doğru" : "Yanlış"})`;

      const valEl = document.createElement("span");
      valEl.className = "part-value";
      valEl.textContent = part.expected;

      box.appendChild(labelEl);
      box.appendChild(valEl);

      if (!part.na && !part.ok && part.user) {
        const userEl = document.createElement("span");
        userEl.className = "part-user";
        userEl.textContent = `Yazılan: ${part.user}`;
        box.appendChild(userEl);
      }

      els.feedbackBreakdown.appendChild(box);
    }
    els.feedbackBreakdown.hidden = false;
  } else {
    els.feedbackBreakdown.hidden = true;
    els.feedbackBreakdown.innerHTML = "";
  }

  if (details.tip) {
    els.feedbackTip.textContent = details.tip;
    els.feedbackTip.hidden = false;
  } else {
    els.feedbackTip.hidden = true;
  }

  if (word.note) {
    els.feedbackNote.textContent = `Not: ${word.note}`;
    els.feedbackNote.hidden = false;
  } else {
    els.feedbackNote.hidden = true;
  }

  const speechReady = isSpeechSupported();
  if (word.example && word.example.de) {
    els.feedbackExampleDe.textContent = word.example.de;
    els.feedbackExampleTr.textContent = word.example.tr || "";
    els.btnSpeakExample.hidden = !speechReady;
    els.feedbackExample.hidden = false;
  } else {
    els.feedbackExample.hidden = true;
  }

  els.btnSpeakAnswer.hidden = !speechReady;

  if (mistakeStatusText) {
    els.feedbackMistakeStatus.textContent = mistakeStatusText;
    els.feedbackMistakeStatus.hidden = false;
  } else {
    els.feedbackMistakeStatus.hidden = true;
  }

  announce(els.feedbackBanner.textContent);
  if (!els.backupDialog.open && runtime.activeTab === "study") {
    window.setTimeout(() => {
      if (!els.backupDialog.open && runtime.activeTab === "study") {
        els.btnNext.focus();
      }
    }, 10);
  }
}

/* Umlaut Insertion */

function insertSpecialChar(char) {
  if (
    runtime.answered ||
    runtime.currentQuestionType !== "typing" ||
    runtime.currentDirection === "de-tr"
  ) {
    return;
  }
  const active = document.activeElement;
  let target = null;
  if (
    active &&
    (active === els.inputSingular ||
      active === els.inputPlural ||
      active === els.inputPhrase) &&
    !active.disabled
  ) {
    target = active;
  } else if (runtime.lastFocusedInput && !runtime.lastFocusedInput.disabled) {
    target = runtime.lastFocusedInput;
  } else if (!els.inputSingular.hidden && !els.inputSingular.disabled) {
    target = els.inputSingular;
  } else if (!els.inputPlural.hidden && !els.inputPlural.disabled) {
    target = els.inputPlural;
  } else if (!els.inputPhrase.hidden && !els.inputPhrase.disabled) {
    target = els.inputPhrase;
  }

  if (!target) {
    return;
  }

  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  target.value =
    target.value.slice(0, start) + char + target.value.slice(end);
  const nextPos = start + char.length;
  target.focus();
  target.setSelectionRange(nextPos, nextPos);
  runtime.lastFocusedInput = target;
}

function updateUmlautCaseLabels() {
  els.toggleUmlautCase.setAttribute(
    "aria-pressed",
    String(runtime.umlautUpper)
  );
  for (const btn of els.umlautBtns) {
    btn.textContent = runtime.umlautUpper ? btn.dataset.upper : btn.dataset.char;
  }
}

/* Dictionary View */

function getFilteredDictionaryWords() {
  const baseWords = getWordsForLesson(runtime.dictLesson);
  const query = normalizeSearchText(runtime.dictQuery.trim());

  return baseWords.filter((word) => {
    const hidden = isWordHidden(word.id);
    if (runtime.dictFilter === "hidden") {
      if (!hidden) {
        return false;
      }
    } else if (hidden) {
      return false;
    }

    if (runtime.dictFilter === "noun" && word.category !== "noun") {
      return false;
    }
    if (
      runtime.dictFilter === "phrase" &&
      word.category !== "phrase" &&
      word.category !== "verb"
    ) {
      return false;
    }
    if (
      ["der", "die", "das", "nur Pl."].includes(runtime.dictFilter) &&
      (word.category !== "noun" || word.article !== runtime.dictFilter)
    ) {
      return false;
    }
    if (runtime.dictFilter === "nur Sg." && !word.onlySingular) {
      return false;
    }
    if (runtime.dictFilter === "mistakes" && !appState.mistakes[word.id]) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      word.tr,
      word.de,
      ...toArray(word.alt),
      ...toArray(word.singular),
      ...toArray(word.plural),
      word.article,
      word.note,
      word.hint,
      word.example?.de,
      word.example?.tr
    ]
      .filter(Boolean)
      .join(" ");

    return normalizeSearchText(haystack).includes(query);
  });
}

function createSpeakerSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.setAttribute("points", "11 5 6 9 2 9 2 15 6 15 11 19 11 5");
  svg.appendChild(poly);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M15.54 8.46a5 5 0 0 1 0 7.07");
  svg.appendChild(path);

  return svg;
}

function renderDictionary() {
  if (els.dictHiddenBadge) {
    const hiddenCount = getHiddenCount();
    els.dictHiddenBadge.textContent = String(hiddenCount);
    els.dictHiddenBadge.hidden = hiddenCount === 0;
  }

  const items = getFilteredDictionaryWords();
  const isFiltered =
    runtime.dictFilter !== "all" ||
    runtime.dictLesson !== "all" ||
    runtime.dictQuery.trim().length > 0;
  els.dictCount.textContent = isFiltered
    ? `${items.length} sonuç`
    : `${items.length} kelime`;
  els.dictList.innerHTML = "";

  if (items.length === 0) {
    if (els.dictEmptyText) {
      els.dictEmptyText.textContent =
        runtime.dictFilter === "hidden" &&
        runtime.dictQuery.trim() === "" &&
        runtime.dictLesson === "all"
          ? "Gizlediğiniz kelime yok."
          : "Arama ölçütünüze uygun kelime bulunamadı.";
    }
    els.dictList.hidden = true;
    els.dictEmpty.hidden = false;
    return;
  }
  els.dictList.hidden = false;
  els.dictEmpty.hidden = true;

  const speechReady = isSpeechSupported();
  const fragment = document.createDocumentFragment();

  for (const word of items) {
    const isHidden = isWordHidden(word.id);
    const li = document.createElement("li");
    li.className = isHidden ? "dict-item is-hidden-item" : "dict-item";
    li.dataset.article = word.category === "noun" ? word.article : word.category;

    const main = document.createElement("div");
    main.className = "dict-item-main";

    const deEl = document.createElement("div");
    deEl.className = "dict-de";
    if (word.category === "noun") {
      deEl.textContent = formatNounSummary(word);
    } else {
      const altList = toArray(word.alt);
      deEl.textContent =
        altList.length > 0 ? `${word.de} / ${altList.join(" / ")}` : word.de;
    }

    const trEl = document.createElement("div");
    trEl.className = "dict-tr";
    trEl.textContent = word.hint ? `${word.tr} (${word.hint})` : word.tr;

    main.appendChild(deEl);
    main.appendChild(trEl);

    if (word.example?.de) {
      const exEl = document.createElement("div");
      exEl.className = "dict-example";
      exEl.textContent = word.example.de;
      main.appendChild(exEl);
    }

    if (word.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "dict-note";
      noteEl.textContent = word.note;
      main.appendChild(noteEl);
    }

    const side = document.createElement("div");
    side.className = "dict-item-side";

    const metaRow = document.createElement("div");
    metaRow.className = "dict-meta-row";

    const srsTag = document.createElement("span");
    if (isHidden) {
      srsTag.className = "srs-tag is-hidden";
      srsTag.textContent = "Gizli";
    } else {
      const srs = getWordSrsStatus(word.id);
      srsTag.className = `srs-tag is-${srs.key}`;
      srsTag.textContent = srs.label;
    }

    const lessonTag = document.createElement("span");
    lessonTag.className = "dict-lesson-tag";
    lessonTag.textContent = `${word.level} ${word.lesson}`;

    metaRow.appendChild(srsTag);
    metaRow.appendChild(lessonTag);

    const sideActions = document.createElement("div");
    sideActions.className = "dict-side-actions";

    if (speechReady) {
      const speakBtn = document.createElement("button");
      speakBtn.type = "button";
      speakBtn.className = "dict-speak-btn";
      speakBtn.setAttribute("aria-label", `${deEl.textContent} telaffuzunu dinle`);
      speakBtn.appendChild(createSpeakerSvg());
      speakBtn.addEventListener("click", () => {
        speakGerman(getSpokenGermanForWord(word, true));
      });
      sideActions.appendChild(speakBtn);
    }

    if (isHidden) {
      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.className = "dict-restore-btn";
      restoreBtn.setAttribute(
        "aria-label",
        `${deEl.textContent} kelimesini tekrar çalışmaya al`
      );
      restoreBtn.textContent = "Geri al";
      restoreBtn.addEventListener("click", () => {
        unhideWord(word.id);
      });
      sideActions.appendChild(restoreBtn);
    } else {
      const isMistake = Boolean(appState.mistakes[word.id]);
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = `dict-mistake-toggle ${isMistake ? "is-marked" : ""}`;
      toggleBtn.setAttribute("aria-pressed", String(isMistake));
      toggleBtn.setAttribute(
        "aria-label",
        isMistake ? "Zorlandıklarımdan çıkar" : "Zorlandıklarıma ekle"
      );
      toggleBtn.textContent = isMistake ? "Zorlandıklarımda" : "Zorlandım";
      toggleBtn.addEventListener("click", () => {
        if (appState.mistakes[word.id]) {
          delete appState.mistakes[word.id];
          appState.mistakeClearedAt[word.id] = Date.now();
        } else {
          appState.mistakes[word.id] = {
            streak: 0,
            misses: 1,
            updatedAt: Date.now()
          };
        }
        saveState({ sync: true });
        updateTopControls();
        renderDictionary();
      });

      const hideBtn = document.createElement("button");
      hideBtn.type = "button";
      hideBtn.className = "dict-hide-btn";
      hideBtn.setAttribute(
        "aria-label",
        `${deEl.textContent} kelimesini çalışma listesinden gizle`
      );
      hideBtn.textContent = "Gizle";
      hideBtn.addEventListener("click", () => {
        hideWord(word.id);
      });

      sideActions.appendChild(toggleBtn);
      sideActions.appendChild(hideBtn);
    }

    side.appendChild(metaRow);
    side.appendChild(sideActions);

    li.appendChild(main);
    li.appendChild(side);
    fragment.appendChild(li);
  }

  els.dictList.appendChild(fragment);
  if (runtime.activeTab === "dictionary") {
    aiTutor?.refreshContext();
  }
}

/* Backup & Stats Modal */

function refreshBackupModal() {
  appState.daily = normalizeDailyState(appState.daily);
  const { totalAnswered, totalCorrect, bestStreak } = appState.progress;
  const accuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const activeWords = getActiveWords();
  const learnedTotal = countMasteredWords(activeWords);

  els.statLearned.textContent = `${learnedTotal} / ${activeWords.length}`;
  els.statDailyStreak.textContent = `${appState.daily.streakDays} gün`;
  els.statTotal.textContent = String(totalAnswered);
  els.statAccuracy.textContent = `%${accuracy}`;
  els.statBestStreak.textContent = String(bestStreak);
  els.statMistakes.textContent = String(getActiveMistakeCount());

  els.dailyGoalSelect.value = String(appState.settings.dailyGoal);
  els.autoSpeakToggle.checked = Boolean(appState.settings.autoSpeak);
  els.autoSpeakToggle.disabled = !isSpeechSupported();

  // Level progress & Leitner SRS summary
  const summaries = getLevelSummary(appState.cards, appState.hiddenWords);
  const now = Date.now();
  let dueCount = 0;
  let learningCount = 0;
  let unseenCount = 0;

  for (const word of activeWords) {
    const card = appState.cards[word.id];
    if (!card || !card.seen) {
      unseenCount += 1;
    } else if (card.box < 4) {
      if (card.nextReviewAt <= now) {
        dueCount += 1;
      } else {
        learningCount += 1;
      }
    }
  }

  const hiddenCount = getHiddenCount();
  const hiddenNote = hiddenCount > 0 ? `, ${hiddenCount} gizli` : "";
  els.srsSummary.textContent = `${dueCount} tekrar zamanı, ${learningCount} öğreniliyor, ${unseenCount} yeni${hiddenNote}`;
  els.levelProgressList.innerHTML = "";

  for (const item of summaries) {
    const pct = item.total > 0 ? Math.round((item.learned / item.total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "level-row";

    const head = document.createElement("div");
    head.className = "level-row-head";

    const name = document.createElement("span");
    name.className = "level-name";
    name.textContent = `${item.level} Seviyesi`;

    const counts = document.createElement("span");
    counts.className = "level-counts";
    counts.textContent = `${item.learned} / ${item.total} öğrenildi (%${pct})`;

    const track = document.createElement("div");
    track.className = "level-bar-track";
    const fill = document.createElement("div");
    fill.className = "level-bar-fill";
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    head.appendChild(name);
    head.appendChild(counts);
    row.appendChild(head);
    row.appendChild(track);
    els.levelProgressList.appendChild(row);
  }

  refreshSyncUI();
  els.resetInitialRow.hidden = false;
  els.resetConfirmRow.hidden = true;
}

function showSyncStatus(message, isError = false) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = message;
  els.syncStatus.className = `backup-status ${isError ? "is-error" : "is-ok"}`;
  els.syncStatus.hidden = false;
}

function formatSyncTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function refreshSyncUI() {
  const cfg = loadSyncConfig();
  const connected = Boolean(cfg.token);
  if (els.syncDisconnected) els.syncDisconnected.hidden = connected;
  if (els.syncConnected) els.syncConnected.hidden = !connected;

  if (els.syncMeta) {
    if (!connected) {
      els.syncMeta.textContent = "Bağlı değil";
    } else if (!navigator.onLine) {
      els.syncMeta.textContent = "Çevrimdışı bekliyor";
    } else if (cfg.lastSyncAt) {
      els.syncMeta.textContent = `Son eşitleme: ${formatSyncTime(cfg.lastSyncAt)}`;
    } else {
      els.syncMeta.textContent = "Bağlı";
    }
  }
}

function setSyncBusy(busy) {
  if (els.btnSyncConnect) {
    els.btnSyncConnect.disabled = busy;
    els.btnSyncConnect.textContent = busy ? "Eşitleniyor..." : "Bağlan ve eşitle";
  }
  if (els.btnSyncNow) {
    els.btnSyncNow.disabled = busy;
    els.btnSyncNow.textContent = busy ? "Eşitleniyor..." : "Şimdi eşitle";
  }
  if (els.btnSyncDisconnect) {
    els.btnSyncDisconnect.disabled = busy;
  }
}

function scheduleBackgroundSync() {
  const cfg = loadSyncConfig();
  if (!cfg.token) {
    return;
  }
  if (syncDebounceTimer) {
    window.clearTimeout(syncDebounceTimer);
  }
  syncDebounceTimer = window.setTimeout(() => {
    syncDebounceTimer = null;
    if (navigator.onLine) {
      runCloudSync({ manual: false });
    } else {
      refreshSyncUI();
    }
  }, 4000);
}

async function runCloudSync({ manual = false, customToken = null } = {}) {
  if (syncInFlight) {
    return;
  }
  const savedCfg = loadSyncConfig();
  const activeToken =
    typeof customToken === "string" ? customToken.trim() : savedCfg.token;

  if (!activeToken) {
    if (manual) {
      showSyncStatus("Lütfen geçerli bir GitHub token'ı girin.", true);
    }
    return;
  }

  const validWordIds = new Set(WORD_BY_ID.keys());
  syncInFlight = true;
  if (manual) {
    if (els.syncStatus) els.syncStatus.hidden = true;
    setSyncBusy(true);
  }

  try {
    const result = await syncWithGitHubGist({
      token: activeToken,
      gistId: customToken ? "" : savedCfg.gistId,
      localState: appState,
      validWordIds,
      normalizeDailyFn: normalizeDailyState
    });

    saveSyncConfig({
      token: activeToken,
      gistId: result.gistId,
      lastSyncAt: Date.now()
    });

    if (result.localChanged) {
      const prevPoolEmpty = runtime.currentWord === null;
      appState = result.mergedState;
      saveState({ sync: false, preserveTimestamp: true });
      populateLessonSelects();
      updateTopControls();
      if (
        prevPoolEmpty ||
        (runtime.activeTab === "study" &&
          !runtime.answered &&
          runtime.currentWord &&
          (isWordHidden(runtime.currentWord.id) ||
            (appState.settings.mode === "mistakes" &&
              !appState.mistakes[runtime.currentWord.id])))
      ) {
        showNextCard();
      }
      if (runtime.activeTab === "dictionary") {
        renderDictionary();
      }
    }

    refreshSyncUI();
    if (els.backupDialog?.open) {
      refreshBackupModal();
    }

    if (manual) {
      if (els.gistTokenInput) {
        els.gistTokenInput.value = "";
      }
      showSyncStatus(
        result.action === "created"
          ? "GitHub Gist hesabı bağlandı ve ilerlemeniz yedeklendi."
          : "İlerlemeniz GitHub Gist ile eşitlendi."
      );
    }
  } catch (err) {
    refreshSyncUI();
    const isAuthError =
      err instanceof SyncHttpError && (err.status === 401 || err.status === 403);
    if (manual || isAuthError) {
      showSyncStatus(err.message || "Senkronizasyon başarısız oldu.", true);
    }
  } finally {
    syncInFlight = false;
    if (manual) {
      setSyncBusy(false);
    }
  }
}

function showBackupStatus(message, isError = false) {
  els.backupStatus.textContent = message;
  els.backupStatus.className = `backup-status ${isError ? "is-error" : "is-ok"}`;
  els.backupStatus.hidden = false;
}

function exportBackupJson() {
  const payload = {
    app: "DeutschKarte",
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: {
      ...appState.settings,
      theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light"
    },
    progress: appState.progress,
    daily: appState.daily,
    cards: appState.cards,
    mistakes: appState.mistakes,
    mistakeClearedAt: appState.mistakeClearedAt,
    hiddenWords: appState.hiddenWords,
    hiddenRestoredAt: appState.hiddenRestoredAt,
    updatedAt: appState.updatedAt,
    resetAt: appState.resetAt
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateTag = getLocalDateKey();
  link.href = url;
  link.download = `deutschkarte-yedek-${dateTag}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showBackupStatus("Yedek dosyası indirildi.");
}

async function importBackupJson(file) {
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.app !== "DeutschKarte" ||
      !parsed.progress
    ) {
      showBackupStatus(
        "Geçersiz yedek dosyası. Lütfen DeutschKarte yedeği seçin.",
        true
      );
      return;
    }

    const cleanMistakes = sanitizeMistakes(parsed.mistakes);
    const cleanCards = sanitizeCards(parsed.cards);
    const { hiddenWords, hiddenRestoredAt } = sanitizeHiddenState(
      parsed.hiddenWords,
      parsed.hiddenRestoredAt
    );
    const lessons = getLessonList().map((l) => l.title);
    const totalAnswered = Math.max(0, Number(parsed.progress.totalAnswered) || 0);
    const totalCorrect = Math.min(
      totalAnswered,
      Math.max(0, Number(parsed.progress.totalCorrect) || 0)
    );
    const bestStreak = Math.max(0, Number(parsed.progress.bestStreak) || 0);
    const rawGoal = Number(parsed.settings?.dailyGoal);

    appState = {
      settings: {
        mode: VALID_MODES.includes(parsed.settings?.mode)
          ? parsed.settings.mode
          : "mixed",
        lesson:
          parsed.settings?.lesson === "all" ||
          lessons.includes(parsed.settings?.lesson)
            ? parsed.settings.lesson
            : "all",
        direction: VALID_DIRECTIONS.includes(parsed.settings?.direction)
          ? parsed.settings.direction
          : "tr-de",
        dailyGoal: VALID_DAILY_GOALS.includes(rawGoal) ? rawGoal : 20,
        autoSpeak: Boolean(parsed.settings?.autoSpeak)
      },
      progress: { totalAnswered, totalCorrect, bestStreak },
      daily: normalizeDailyState(parsed.daily),
      cards: cleanCards,
      mistakes: cleanMistakes,
      mistakeClearedAt: sanitizeClearedAt(parsed.mistakeClearedAt),
      hiddenWords,
      hiddenRestoredAt,
      updatedAt: Date.now(),
      resetAt: Math.max(0, Number(parsed.resetAt) || 0)
    };
    if (VALID_THEMES.includes(parsed.settings?.theme)) {
      applyTheme(parsed.settings.theme, true);
    }
    hideUndoToast();
    saveState({ sync: true, preserveTimestamp: true });
    populateLessonSelects();
    refreshBackupModal();
    updateTopControls();
    showNextCard();
    if (runtime.activeTab === "dictionary") {
      renderDictionary();
    }
    showBackupStatus("Yedek geri yüklendi.");
  } catch {
    showBackupStatus("Dosya okunamadı. Geçerli bir JSON dosyası seçin.", true);
  } finally {
    els.inputImportJson.value = "";
  }
}

/* Theme Management */

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (VALID_THEMES.includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme, persist = false) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute(
      "content",
      resolved === "dark" ? "#1B2738" : "#1E4DB7"
    );
  }

  if (els.toggleTheme) {
    const isDark = resolved === "dark";
    els.toggleTheme.setAttribute("aria-pressed", String(isDark));
    els.toggleTheme.setAttribute(
      "aria-label",
      isDark ? "Aydınlık moda geç" : "Karanlık moda geç"
    );
  }

  if (els.themeToggleLabel) {
    els.themeToggleLabel.textContent =
      resolved === "dark" ? "Aydınlık" : "Karanlık";
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, resolved);
    } catch {
      // Ignore storage quota errors
    }
  }
}

function watchSystemTheme() {
  if (!window.matchMedia) {
    return;
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = (event) => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (VALID_THEMES.includes(saved)) {
        return;
      }
    } catch {
      // Ignore storage errors
    }
    applyTheme(event.matches ? "dark" : "light", false);
  };
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
  }
}

/* Grammar Notes & Conjugation Drill */

function getVerbGroupLabel(group) {
  if (group === "td") return "-t / -d (-e- kuralı)";
  if (group === "irregular") return "Düzensiz";
  return "Düzenli";
}

function getConjugationSpokenText(verb, slot) {
  const pronoun = slot.label.split("/")[0].trim();
  return `${pronoun} ${verb.forms[slot.key]}`;
}

function getConjugationChoiceOptions(verb, slot) {
  const expected = verb.forms[slot.key];
  const rawStem = verb.infinitive.replace(/en$/i, "");
  const trapPool = [];

  if (verb.group === "td") {
    trapPool.push(
      `${rawStem}st`,
      `${rawStem}t`,
      `${rawStem}est`,
      `${rawStem}et`,
      `${rawStem}e`
    );
  }
  if (verb.infinitive === "kommen") {
    trapPool.push("komt", "kommst", "komme", "kommen");
  } else if (verb.infinitive === "haben") {
    trapPool.push("hast", "habt", "habst", "hat", "habe", "haben");
  } else if (verb.infinitive === "sein") {
    trapPool.push("bin", "bist", "ist", "sind", "seid");
  } else if (verb.infinitive === "heißen") {
    trapPool.push("heißst", "heiße", "heißt", "heißen");
  } else if (verb.infinitive === "sprechen" || verb.infinitive === "helfen") {
    trapPool.push(`${rawStem}st`, `${rawStem}t`, `${rawStem}e`, `${rawStem}en`);
  }

  const sameVerbForms = shuffleArray(Object.values(verb.forms));
  const genericForms = [
    `${rawStem}e`,
    `${rawStem}st`,
    `${rawStem}t`,
    `${rawStem}en`
  ];

  const distractors = [];
  const seen = new Set([expected]);
  for (const candidate of [...shuffleArray(trapPool), ...sameVerbForms, ...genericForms]) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    distractors.push({ label: candidate, isCorrect: false });
    if (distractors.length >= 3) break;
  }

  return shuffleArray([{ label: expected, isCorrect: true }, ...distractors]);
}

function updateConjugationStrip() {
  if (els.conjScore) {
    els.conjScore.textContent = `${runtime.conjScore} / ${runtime.conjAnsweredCount}`;
  }
  if (els.conjStreak) {
    els.conjStreak.textContent = String(runtime.conjStreak);
  }
}

function switchGrammarSubTab(subTab) {
  runtime.grammarSubTab = subTab === "notes" ? "notes" : "drill";
  const isDrill = runtime.grammarSubTab === "drill";

  els.grammarSubDrill?.classList.toggle("is-active", isDrill);
  els.grammarSubDrill?.setAttribute("aria-pressed", String(isDrill));
  els.grammarSubNotes?.classList.toggle("is-active", !isDrill);
  els.grammarSubNotes?.setAttribute("aria-pressed", String(!isDrill));

  if (els.grammarDrillPanel) els.grammarDrillPanel.hidden = !isDrill;
  if (els.grammarNotesPanel) els.grammarNotesPanel.hidden = isDrill;

  if (!isDrill && !runtime.grammarNotesRendered) {
    renderGrammarNotes();
  }
  if (isDrill && !runtime.conjCurrent) {
    showNextConjugation();
  }
  aiTutor?.refreshContext();
}

function showNextConjugation() {
  const pool =
    runtime.conjGroup === "all"
      ? CONJUGATION_VERBS
      : CONJUGATION_VERBS.filter((verb) => verb.group === runtime.conjGroup);
  const verbs = pool.length > 0 ? pool : CONJUGATION_VERBS;

  const pairs = [];
  for (const verb of verbs) {
    for (const slot of PRONOUN_SLOTS) {
      pairs.push({ verb, slot, pairKey: `${verb.id}:${slot.key}` });
    }
  }
  const filteredPairs =
    pairs.length > 1
      ? pairs.filter((p) => p.pairKey !== runtime.conjLastPairKey)
      : pairs;
  let totalWeight = 0;
  const weighted = filteredPairs.map((p) => {
    const w = (runtime.conjMistakes[p.pairKey] || 0) > 0 ? 3 : 1;
    totalWeight += w;
    return { item: p, weight: w };
  });
  let roll = Math.random() * totalWeight;
  let picked = filteredPairs[0];
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) {
      picked = entry.item;
      break;
    }
  }

  const { verb, slot, pairKey } = picked;
  const expected = verb.forms[slot.key];
  const options =
    runtime.conjMode === "choice"
      ? getConjugationChoiceOptions(verb, slot)
      : [];

  runtime.conjLastPairKey = pairKey;
  runtime.conjCurrent = { verb, slot, expected, options };
  runtime.conjAnswered = false;

  if (els.conjCard) {
    els.conjCard.dataset.gender = "neutral";
    els.conjCard.classList.remove("is-advancing");
    void els.conjCard.offsetWidth;
    els.conjCard.classList.add("is-advancing");
  }

  if (els.conjGroupLabel) {
    els.conjGroupLabel.textContent = `${verb.lesson}, ${getVerbGroupLabel(verb.group)}`;
  }
  if (els.conjInfinitiveMeaning) {
    els.conjInfinitiveMeaning.textContent = verb.tr;
  }
  if (els.conjPronoun) {
    els.conjPronoun.textContent = slot.label;
  }
  if (els.conjVerb) {
    els.conjVerb.textContent = verb.infinitive;
  }
  if (els.conjTrCue) {
    els.conjTrCue.textContent = `${slot.tr} — ${verb.tr}`;
  }
  if (els.conjSpeakPrompt) {
    els.conjSpeakPrompt.hidden = !isSpeechSupported();
  }

  updateConjugationStrip();

  if (els.conjFeedbackArea) els.conjFeedbackArea.hidden = true;
  if (els.conjInputGuidance) {
    els.conjInputGuidance.hidden = true;
    els.conjInputGuidance.textContent = "";
  }

  if (runtime.conjMode === "choice") {
    if (els.conjTypingArea) els.conjTypingArea.hidden = true;
    if (els.conjChoiceArea) els.conjChoiceArea.hidden = false;
    if (els.conjChoiceActions) els.conjChoiceActions.hidden = false;
    if (els.conjChoiceList) {
      els.conjChoiceList.innerHTML = "";
      options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.dataset.index = String(idx);

        const keySpan = document.createElement("span");
        keySpan.className = "choice-key";
        keySpan.textContent = String(idx + 1);

        const textSpan = document.createElement("span");
        textSpan.textContent = `${slot.label.split("/")[0].trim()} ${opt.label}`;

        btn.appendChild(keySpan);
        btn.appendChild(textSpan);
        btn.addEventListener("click", () => handleConjugationChoiceSelect(idx));
        els.conjChoiceList.appendChild(btn);
      });
    }
  } else {
    if (els.conjChoiceArea) els.conjChoiceArea.hidden = true;
    if (els.conjTypingArea) els.conjTypingArea.hidden = false;
    if (els.conjUmlautBar) els.conjUmlautBar.hidden = false;
    if (els.conjTypingActions) els.conjTypingActions.hidden = false;
    if (els.conjInput) {
      els.conjInput.value = "";
      els.conjInput.disabled = false;
      if (
        !els.backupDialog?.open &&
        runtime.activeTab === "grammar" &&
        runtime.grammarSubTab === "drill"
      ) {
        window.setTimeout(() => {
          if (
            !els.backupDialog?.open &&
            runtime.activeTab === "grammar" &&
            runtime.grammarSubTab === "drill"
          ) {
            els.conjInput.focus();
          }
        }, 10);
      }
    }
    for (const btn of els.conjUmlautBtns) {
      btn.disabled = false;
    }
  }
  aiTutor?.refreshContext();
}

function handleConjugationChoiceSelect(index) {
  if (runtime.conjAnswered || !runtime.conjCurrent) {
    return;
  }
  const chosen = runtime.conjCurrent.options[index];
  if (!chosen) {
    return;
  }

  const buttons = Array.from(
    els.conjChoiceList?.querySelectorAll(".choice-btn") || []
  );
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    const opt = runtime.conjCurrent.options[idx];
    if (opt?.isCorrect) {
      btn.classList.add("is-correct");
    } else if (idx === index && !opt?.isCorrect) {
      btn.classList.add("is-wrong");
    }
  });

  if (els.conjChoiceActions) {
    els.conjChoiceActions.hidden = true;
  }
  finalizeConjugation(chosen.isCorrect, null);
}

function evaluateConjugationInput(rawInput, verb, slot) {
  const expected = verb.forms[slot.key];
  let candidate = collapseSpaces(rawInput);

  const allowedPrefixes = slot.label
    .split("/")
    .map((part) => part.trim().toLowerCase());
  const firstSpace = candidate.indexOf(" ");
  if (firstSpace > 0) {
    const firstWord = candidate.slice(0, firstSpace).toLowerCase();
    if (allowedPrefixes.includes(firstWord)) {
      candidate = collapseSpaces(candidate.slice(firstSpace + 1));
    }
  }

  if (candidate === expected) {
    return { ok: true, tip: null };
  }
  if (candidate.toLowerCase() === expected.toLowerCase()) {
    return {
      ok: true,
      tip: "İpucu: Almancada çekimli fiiller cümle içinde küçük harfle yazılır."
    };
  }
  if (
    expected.includes("ß") &&
    !candidate.includes("ß") &&
    candidate.toLowerCase().replace(/ß/g, "ss") ===
      expected.toLowerCase().replace(/ß/g, "ss")
  ) {
    return {
      ok: false,
      tip: "İpucu: Bu fiilde \"ss\" yerine \"ß\" harfi kullanılır."
    };
  }
  return { ok: false, tip: null };
}

function handleConjugationTypingSubmit() {
  if (runtime.conjAnswered || !runtime.conjCurrent || !els.conjInput) {
    return;
  }
  const raw = collapseSpaces(els.conjInput.value);
  if (!raw) {
    if (els.conjInputGuidance) {
      els.conjInputGuidance.textContent =
        "Çekimli fiili yazın veya \"Kartı atla\" ile sıradaki soruya geçin.";
      els.conjInputGuidance.hidden = false;
    }
    els.conjInput.focus();
    return;
  }

  if (els.conjInputGuidance) {
    els.conjInputGuidance.hidden = true;
  }
  els.conjInput.disabled = true;
  if (els.conjUmlautBar) {
    els.conjUmlautBar.hidden = true;
  }
  for (const btn of els.conjUmlautBtns) {
    btn.disabled = true;
  }
  if (els.conjTypingActions) {
    els.conjTypingActions.hidden = true;
  }

  const { verb, slot } = runtime.conjCurrent;
  const res = evaluateConjugationInput(raw, verb, slot);
  finalizeConjugation(res.ok, res.tip);
}

function finalizeConjugation(isCorrect, customTip) {
  if (!runtime.conjCurrent) {
    return;
  }
  const { verb, slot } = runtime.conjCurrent;
  const pairKey = `${verb.id}:${slot.key}`;
  const spokenTarget = getConjugationSpokenText(verb, slot);

  runtime.conjAnswered = true;
  runtime.conjAnsweredCount += 1;
  if (isCorrect) {
    runtime.conjScore += 1;
    runtime.conjStreak += 1;
    if (runtime.conjMistakes[pairKey]) {
      runtime.conjMistakes[pairKey] -= 1;
      if (runtime.conjMistakes[pairKey] <= 0) {
        delete runtime.conjMistakes[pairKey];
      }
    }
  } else {
    runtime.conjStreak = 0;
    runtime.conjMistakes[pairKey] = (runtime.conjMistakes[pairKey] || 0) + 1;
  }
  updateConjugationStrip();

  if (els.conjCard) {
    els.conjCard.dataset.gender = isCorrect ? "das" : "die";
  }

  if (els.conjFeedbackArea) {
    els.conjFeedbackArea.hidden = false;
  }
  if (els.conjFeedbackBanner) {
    els.conjFeedbackBanner.className = `feedback-banner ${
      isCorrect ? "is-correct" : "is-wrong"
    }`;
    els.conjFeedbackBanner.textContent = isCorrect
      ? `Doğru: ${spokenTarget}`
      : `Yanlış. Doğru cevap: ${spokenTarget}`;
  }

  const tipToShow = [customTip, verb.ruleTip].filter(Boolean).join(" ");
  if (els.conjRuleTip) {
    if (tipToShow) {
      els.conjRuleTip.textContent = tipToShow;
      els.conjRuleTip.hidden = false;
    } else {
      els.conjRuleTip.hidden = true;
    }
  }

  if (els.conjPrincipalParts) {
    if (verb.principalParts) {
      els.conjPrincipalParts.textContent = `Temel biçimler (Präsens · Präteritum · Perfekt): ${verb.principalParts}`;
      els.conjPrincipalParts.hidden = false;
    } else {
      els.conjPrincipalParts.hidden = true;
    }
  }

  if (els.conjMiniTable) {
    els.conjMiniTable.innerHTML = "";
    for (const rowSlot of PRONOUN_SLOTS) {
      const row = document.createElement("div");
      row.className =
        rowSlot.key === slot.key ? "conj-mini-row is-highlight" : "conj-mini-row";

      const pSpan = document.createElement("span");
      pSpan.className = "conj-mini-pronoun";
      pSpan.textContent = rowSlot.label;

      const fSpan = document.createElement("span");
      fSpan.className = "conj-mini-form";
      fSpan.textContent = verb.forms[rowSlot.key];

      row.appendChild(pSpan);
      row.appendChild(fSpan);
      els.conjMiniTable.appendChild(row);
    }
  }

  if (els.conjExample) {
    if (verb.example?.de) {
      els.conjExampleDe.textContent = verb.example.de;
      els.conjExampleTr.textContent = verb.example.tr || "";
      els.conjExample.hidden = false;
    } else {
      els.conjExample.hidden = true;
    }
  }

  const speechReady = isSpeechSupported();
  if (els.conjSpeak) {
    els.conjSpeak.hidden = !speechReady;
  }
  if (els.conjSpeakExample) {
    els.conjSpeakExample.hidden = !speechReady;
  }
  if (appState.settings.autoSpeak) {
    speakGerman(spokenTarget);
  }

  announce(els.conjFeedbackBanner?.textContent || spokenTarget);
  aiTutor?.refreshContext();
  if (
    !els.backupDialog?.open &&
    runtime.activeTab === "grammar" &&
    runtime.grammarSubTab === "drill"
  ) {
    window.setTimeout(() => {
      if (
        !els.backupDialog?.open &&
        runtime.activeTab === "grammar" &&
        runtime.grammarSubTab === "drill"
      ) {
        els.conjNext?.focus();
      }
    }, 10);
  }
}

function insertConjChar(char) {
  if (
    runtime.conjAnswered ||
    runtime.conjMode !== "typing" ||
    !els.conjInput ||
    els.conjInput.disabled
  ) {
    return;
  }
  const target = els.conjInput;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  target.value =
    target.value.slice(0, start) + char + target.value.slice(end);
  const nextPos = start + char.length;
  target.focus();
  target.setSelectionRange(nextPos, nextPos);
}

function renderGrammarNotes() {
  if (!els.grammarNotesList) {
    return;
  }
  els.grammarNotesList.innerHTML = "";
  const speechReady = isSpeechSupported();
  const fragment = document.createDocumentFragment();

  for (const note of GRAMMAR_NOTES) {
    const card = document.createElement("article");
    card.className = "grammar-note-card";

    const head = document.createElement("div");
    head.className = "grammar-note-head";

    const title = document.createElement("h2");
    title.className = "grammar-note-title";
    title.textContent = note.title;

    const badge = document.createElement("span");
    badge.className = "grammar-note-badge";
    badge.textContent = `${note.level} · ${note.badge}`;

    head.appendChild(title);
    head.appendChild(badge);
    card.appendChild(head);

    if (note.summary) {
      const summary = document.createElement("p");
      summary.className = "grammar-note-summary";
      summary.textContent = note.summary;
      card.appendChild(summary);
    }

    if (note.table && Array.isArray(note.table.rows)) {
      const wrap = document.createElement("div");
      wrap.className = "grammar-table-wrap";

      const table = document.createElement("table");
      table.className = "grammar-table";

      if (Array.isArray(note.table.headers)) {
        const thead = document.createElement("thead");
        const tr = document.createElement("tr");
        for (const hText of note.table.headers) {
          const th = document.createElement("th");
          th.scope = "col";
          th.textContent = hText;
          tr.appendChild(th);
        }
        thead.appendChild(tr);
        table.appendChild(thead);
      }

      const tbody = document.createElement("tbody");
      for (const rowCells of note.table.rows) {
        const tr = document.createElement("tr");
        for (const cellText of rowCells) {
          const td = document.createElement("td");
          td.textContent = cellText;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
    }

    if (note.tip) {
      const tip = document.createElement("p");
      tip.className = "feedback-tip";
      tip.textContent = note.tip;
      card.appendChild(tip);
    }

    if (note.example?.de) {
      const ex = document.createElement("div");
      ex.className = "feedback-example";

      const copy = document.createElement("div");
      copy.className = "example-copy";

      const exDe = document.createElement("span");
      exDe.className = "example-de";
      exDe.textContent = note.example.de;

      const exTr = document.createElement("span");
      exTr.className = "example-tr";
      exTr.textContent = note.example.tr || "";

      copy.appendChild(exDe);
      copy.appendChild(exTr);
      ex.appendChild(copy);

      if (speechReady) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "speak-btn speak-btn-sm";
        btn.setAttribute("aria-label", `${note.example.de} örneğini dinle`);
        btn.appendChild(createSpeakerSvg());
        const label = document.createElement("span");
        label.textContent = "Dinle";
        btn.appendChild(label);
        btn.addEventListener("click", () => speakGerman(note.example.de));
        ex.appendChild(btn);
      }

      card.appendChild(ex);
    }

    fragment.appendChild(card);
  }

  els.grammarNotesList.appendChild(fragment);
  runtime.grammarNotesRendered = true;
}

/* Tab Switching & Events */

function switchTab(tabName) {
  runtime.activeTab = tabName;
  const isStudy = tabName === "study";
  const isGrammar = tabName === "grammar";
  const isDict = tabName === "dictionary";

  els.tabStudy.classList.toggle("is-active", isStudy);
  els.tabStudy.setAttribute("aria-pressed", String(isStudy));
  els.tabGrammar?.classList.toggle("is-active", isGrammar);
  els.tabGrammar?.setAttribute("aria-pressed", String(isGrammar));
  els.tabDictionary.classList.toggle("is-active", isDict);
  els.tabDictionary.setAttribute("aria-pressed", String(isDict));

  els.studyView.hidden = !isStudy;
  if (els.grammarView) els.grammarView.hidden = !isGrammar;
  els.dictionaryView.hidden = !isDict;

  if (isDict) {
    renderDictionary();
  } else if (isGrammar) {
    if (!runtime.grammarInitialized) {
      runtime.grammarInitialized = true;
      showNextConjugation();
    }
    if (runtime.grammarSubTab === "notes" && !runtime.grammarNotesRendered) {
      renderGrammarNotes();
    }
  }
  aiTutor?.refreshContext();
}

function bindEvents() {
  els.tabStudy?.addEventListener("click", () => switchTab("study"));
  els.tabGrammar?.addEventListener("click", () => switchTab("grammar"));
  els.tabDictionary?.addEventListener("click", () => switchTab("dictionary"));

  els.grammarSubDrill?.addEventListener("click", () =>
    switchGrammarSubTab("drill")
  );
  els.grammarSubNotes?.addEventListener("click", () =>
    switchGrammarSubTab("notes")
  );

  for (const chip of els.grammarGroupChips) {
    chip.addEventListener("click", () => {
      runtime.conjGroup = chip.dataset.group || "all";
      for (const item of els.grammarGroupChips) {
        item.classList.toggle("is-active", item === chip);
      }
      showNextConjugation();
    });
  }

  for (const btn of els.conjModeBtns) {
    btn.addEventListener("click", () => {
      runtime.conjMode = btn.dataset.conjMode === "typing" ? "typing" : "choice";
      for (const item of els.conjModeBtns) {
        const active = item === btn;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      }
      showNextConjugation();
    });
  }

  els.conjReset?.addEventListener("click", () => {
    runtime.conjScore = 0;
    runtime.conjAnsweredCount = 0;
    runtime.conjStreak = 0;
    runtime.conjMistakes = {};
    updateConjugationStrip();
    announce("Çekim sayacı sıfırlandı.");
  });

  for (const btn of els.conjUmlautBtns) {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => insertConjChar(btn.dataset.char || ""));
  }

  els.conjCheck?.addEventListener("click", handleConjugationTypingSubmit);
  els.conjSkipChoice?.addEventListener("click", showNextConjugation);
  els.conjSkipTyping?.addEventListener("click", showNextConjugation);
  els.conjNext?.addEventListener("click", showNextConjugation);
  els.conjSpeakPrompt?.addEventListener("click", () => {
    if (runtime.conjCurrent?.verb?.infinitive) {
      speakGerman(runtime.conjCurrent.verb.infinitive);
    }
  });
  els.conjSpeakExample?.addEventListener("click", () => {
    if (runtime.conjCurrent?.verb?.example?.de) {
      speakGerman(runtime.conjCurrent.verb.example.de);
    }
  });
  els.conjSpeak?.addEventListener("click", () => {
    if (runtime.conjCurrent) {
      speakGerman(
        getConjugationSpokenText(
          runtime.conjCurrent.verb,
          runtime.conjCurrent.slot
        )
      );
    }
  });

  for (const btn of els.modeBtns) {
    btn.addEventListener("click", () => {
      appState.settings.mode = btn.dataset.mode;
      saveState({ sync: false, preserveTimestamp: true });
      showNextCard();
    });
  }

  for (const btn of els.dirBtns) {
    btn.addEventListener("click", () => {
      if (appState.settings.mode === "articles") {
        return;
      }
      appState.settings.direction = btn.dataset.dir;
      saveState({ sync: false, preserveTimestamp: true });
      showNextCard();
    });
  }

  els.lessonSelect?.addEventListener("change", () => {
    appState.settings.lesson = els.lessonSelect.value;
    saveState({ sync: false, preserveTimestamp: true });
    showNextCard();
  });

  els.resetSession?.addEventListener("click", () => {
    runtime.sessionAnswered = 0;
    runtime.sessionCorrect = 0;
    runtime.sessionStreak = 0;
    updateTopControls();
    announce("Oturum sayacı sıfırlandı.");
  });

  els.emptySwitchMixed?.addEventListener("click", () => {
    appState.settings.mode = "mixed";
    saveState({ sync: false, preserveTimestamp: true });
    showNextCard();
  });

  els.emptyAllLessons?.addEventListener("click", () => {
    appState.settings.lesson = "all";
    saveState({ sync: false, preserveTimestamp: true });
    showNextCard();
  });

  els.emptyOpenHidden?.addEventListener("click", () => {
    runtime.dictFilter = "hidden";
    runtime.dictLesson = appState.settings.lesson;
    els.dictLessonSelect.value = runtime.dictLesson;
    for (const chip of els.dictFilterChips) {
      chip.classList.toggle("is-active", chip.dataset.filter === "hidden");
    }
    switchTab("dictionary");
  });

  els.btnHideWord?.addEventListener("click", () => {
    if (runtime.currentWord) {
      hideWord(runtime.currentWord.id, { fromCard: true });
    }
  });

  els.btnUndoHide?.addEventListener("click", () => {
    if (lastHiddenWordId) {
      unhideWord(lastHiddenWordId, { fromUndo: true });
    }
  });

  for (const btn of els.articleBtns) {
    btn.addEventListener("click", () => {
      if (runtime.answered) {
        return;
      }
      const clicked = btn.dataset.article;
      runtime.selectedArticle =
        runtime.selectedArticle === clicked ? null : clicked;
      for (const item of els.articleBtns) {
        const isSelected = item.dataset.article === runtime.selectedArticle;
        item.classList.toggle("is-selected", isSelected);
        item.setAttribute("aria-pressed", String(isSelected));
      }
      applyNounFieldLocks();
    });
  }

  for (const btn of els.articleDrillBtns) {
    btn.addEventListener("click", () => {
      handleArticleDrillSelect(Number(btn.dataset.index));
    });
  }

  for (const input of [els.inputSingular, els.inputPlural, els.inputPhrase]) {
    input?.addEventListener("focus", () => {
      runtime.lastFocusedInput = input;
    });
  }

  for (const btn of els.umlautBtns) {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    btn.addEventListener("click", () => {
      const char = runtime.umlautUpper ? btn.dataset.upper : btn.dataset.char;
      insertSpecialChar(char);
    });
  }

  els.toggleUmlautCase?.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  els.toggleUmlautCase?.addEventListener("click", () => {
    runtime.umlautUpper = !runtime.umlautUpper;
    updateUmlautCaseLabels();
  });

  els.btnCheck?.addEventListener("click", handleTypingSubmit);
  els.btnSkip?.addEventListener("click", showNextCard);
  els.btnSkipChoice?.addEventListener("click", showNextCard);
  els.btnSkipArticle?.addEventListener("click", showNextCard);
  els.btnNext?.addEventListener("click", showNextCard);

  els.btnSpeakPrompt?.addEventListener("click", () => {
    if (!runtime.currentWord) {
      return;
    }
    const includeArt = runtime.currentQuestionType !== "articles";
    speakGerman(getSpokenGermanForWord(runtime.currentWord, includeArt));
  });

  els.btnSpeakAnswer?.addEventListener("click", () => {
    if (runtime.currentWord) {
      speakGerman(getSpokenGermanForWord(runtime.currentWord, true));
    }
  });

  els.btnSpeakExample?.addEventListener("click", () => {
    if (runtime.currentWord?.example?.de) {
      speakGerman(runtime.currentWord.example.de);
    }
  });

  els.dictSearch?.addEventListener("input", () => {
    runtime.dictQuery = els.dictSearch.value;
    renderDictionary();
  });

  els.dictLessonSelect?.addEventListener("change", () => {
    runtime.dictLesson = els.dictLessonSelect.value;
    renderDictionary();
  });

  for (const chip of els.dictFilterChips) {
    chip.addEventListener("click", () => {
      runtime.dictFilter = chip.dataset.filter;
      for (const item of els.dictFilterChips) {
        item.classList.toggle("is-active", item === chip);
      }
      renderDictionary();
    });
  }

  els.dictClearFilters?.addEventListener("click", () => {
    runtime.dictFilter = "all";
    runtime.dictLesson = "all";
    runtime.dictQuery = "";
    els.dictSearch.value = "";
    els.dictLessonSelect.value = "all";
    for (const chip of els.dictFilterChips) {
      chip.classList.toggle("is-active", chip.dataset.filter === "all");
    }
    renderDictionary();
  });

  els.toggleTheme?.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
    announce(
      nextTheme === "dark"
        ? "Karanlık mod etkinleştirildi."
        : "Aydınlık mod etkinleştirildi."
    );
  });

  els.openBackup?.addEventListener("click", () => {
    if (els.backupStatus) els.backupStatus.hidden = true;
    if (els.syncStatus) els.syncStatus.hidden = true;
    refreshBackupModal();
    if (typeof els.backupDialog.showModal === "function") {
      els.backupDialog.showModal();
    } else {
      els.backupDialog.setAttribute("open", "");
    }
  });

  els.closeBackup?.addEventListener("click", () => {
    els.backupDialog.close();
  });

  els.backupDialog?.addEventListener("click", (e) => {
    if (e.target === els.backupDialog) {
      els.backupDialog.close();
    }
  });

  els.dailyGoalSelect?.addEventListener("change", () => {
    const val = Number(els.dailyGoalSelect.value);
    if (VALID_DAILY_GOALS.includes(val)) {
      appState.settings.dailyGoal = val;
      saveState({ sync: true });
      updateTopControls();
      refreshBackupModal();
    }
  });

  els.autoSpeakToggle?.addEventListener("change", () => {
    appState.settings.autoSpeak = Boolean(els.autoSpeakToggle.checked);
    saveState({ sync: true });
  });

  els.btnSyncConnect?.addEventListener("click", () => {
    runCloudSync({
      manual: true,
      customToken: els.gistTokenInput?.value || ""
    });
  });

  els.gistTokenInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCloudSync({
        manual: true,
        customToken: els.gistTokenInput.value
      });
    }
  });

  els.btnSyncNow?.addEventListener("click", () => {
    runCloudSync({ manual: true });
  });

  els.btnSyncDisconnect?.addEventListener("click", () => {
    if (syncDebounceTimer) {
      window.clearTimeout(syncDebounceTimer);
      syncDebounceTimer = null;
    }
    clearSyncConfig();
    refreshSyncUI();
    showSyncStatus("Bulut bağlantısı kesildi. Cihazdaki yerel verileriniz korundu.");
  });

  els.btnExportJson?.addEventListener("click", exportBackupJson);
  els.btnImportJson?.addEventListener("click", () => {
    els.inputImportJson.click();
  });
  els.inputImportJson?.addEventListener("change", (e) => {
    importBackupJson(e.target.files?.[0]);
  });

  els.btnResetAsk?.addEventListener("click", () => {
    els.resetInitialRow.hidden = true;
    els.resetConfirmRow.hidden = false;
  });

  els.btnResetCancel?.addEventListener("click", () => {
    els.resetConfirmRow.hidden = true;
    els.resetInitialRow.hidden = false;
  });

  els.btnResetConfirm?.addEventListener("click", () => {
    const keptTheme = document.documentElement.dataset.theme;
    const now = Date.now();
    appState = createDefaultState();
    appState.resetAt = now;
    appState.updatedAt = now;
    runtime.sessionAnswered = 0;
    runtime.sessionCorrect = 0;
    runtime.sessionStreak = 0;
    hideUndoToast();
    saveState({ sync: true, preserveTimestamp: true });
    if (VALID_THEMES.includes(keptTheme)) {
      applyTheme(keptTheme, false);
    }
    populateLessonSelects();
    refreshBackupModal();
    updateTopControls();
    showNextCard();
    if (runtime.activeTab === "dictionary") {
      renderDictionary();
    }
    showBackupStatus("Tüm ilerleme sıfırlandı.");
  });

  window.addEventListener("online", () => {
    if (loadSyncConfig().token) {
      runCloudSync({ manual: false });
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      const cfg = loadSyncConfig();
      if (cfg.token && Date.now() - cfg.lastSyncAt > 60000) {
        runCloudSync({ manual: false });
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (els.backupDialog.open || aiTutor?.isOpen()) {
      return;
    }

    if (runtime.activeTab === "grammar") {
      if (runtime.grammarSubTab !== "drill" || !runtime.conjCurrent) {
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        speakGerman(
          runtime.conjAnswered
            ? getConjugationSpokenText(
                runtime.conjCurrent.verb,
                runtime.conjCurrent.slot
              )
            : runtime.conjCurrent.verb.infinitive
        );
        return;
      }

      if (
        !runtime.conjAnswered &&
        runtime.conjMode === "choice" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        ["1", "2", "3", "4"].includes(e.key)
      ) {
        e.preventDefault();
        handleConjugationChoiceSelect(Number(e.key) - 1);
        return;
      }

      if (e.key === "Enter") {
        const targetTag = e.target?.tagName;
        if (targetTag === "SELECT") {
          return;
        }
        if (
          targetTag === "BUTTON" &&
          e.target !== els.conjNext &&
          e.target !== els.conjCheck
        ) {
          return;
        }
        e.preventDefault();
        if (runtime.conjAnswered) {
          showNextConjugation();
        } else if (runtime.conjMode === "typing") {
          handleConjugationTypingSubmit();
        }
      }
      return;
    }

    if (runtime.activeTab !== "study" || !runtime.currentWord) {
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "s") {
      const canSpeakPrompt =
        runtime.currentQuestionType === "articles" ||
        runtime.currentDirection === "de-tr";
      if (runtime.answered) {
        e.preventDefault();
        speakGerman(getSpokenGermanForWord(runtime.currentWord, true));
      } else if (canSpeakPrompt) {
        e.preventDefault();
        speakGerman(
          getSpokenGermanForWord(
            runtime.currentWord,
            runtime.currentQuestionType !== "articles"
          )
        );
      }
      return;
    }

    if (
      !runtime.answered &&
      (runtime.currentQuestionType === "choice" ||
        runtime.currentQuestionType === "articles") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey &&
      ["1", "2", "3", "4"].includes(e.key)
    ) {
      e.preventDefault();
      const idx = Number(e.key) - 1;
      if (runtime.currentQuestionType === "articles") {
        handleArticleDrillSelect(idx);
      } else {
        handleChoiceSelect(idx);
      }
      return;
    }

    if (e.key === "Enter") {
      const targetTag = e.target?.tagName;
      if (targetTag === "SELECT") {
        return;
      }
      if (
        targetTag === "BUTTON" &&
        e.target !== els.btnNext &&
        e.target !== els.btnCheck
      ) {
        return;
      }
      e.preventDefault();
      if (runtime.answered) {
        showNextCard();
      } else if (runtime.currentQuestionType === "typing") {
        handleTypingSubmit();
      }
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Silent fallback if SW registration fails
      });
    });
  }
}

function buildAiScreenContext() {
  if (runtime.activeTab === "grammar") {
    if (runtime.grammarSubTab === "notes") {
      const noteSummaries = GRAMMAR_NOTES.map(
        (n, idx) =>
          `${idx + 1}. ${n.title} (${n.badge}): ${n.summary}${n.tip ? ` İpucu: ${n.tip}` : ""}`
      ).join("\n");
      return {
        tab: "grammar",
        subTab: "notes",
        answered: true,
        label: "Ders Notları ve Tablolar",
        summary: `Sekme: Çekim ve Notlar -> Ders Notları ve Tablolar\nEkrandaki not başlıkları:\n${noteSummaries}`
      };
    }

    const cur = runtime.conjCurrent;
    if (!cur) {
      return {
        tab: "grammar",
        subTab: "drill",
        answered: false,
        label: "Çekim Pratiği",
        summary: "Sekme: Çekim ve Notlar -> Çekim Pratiği (henüz aktif fiil yüklenmedi)."
      };
    }

    const { verb, slot, expected } = cur;
    const modeLabel = runtime.conjMode === "typing" ? "Yazmalı" : "Şıklı";
    const lines = [
      `Sekme: Çekim ve Notlar -> Çekim Pratiği (${modeLabel})`,
      `Fiil: ${verb.infinitive} (${verb.tr}) · Grup: ${getVerbGroupLabel(verb.group)}`,
      `İstenen zamir: ${slot.label} (${slot.tr})`,
      `Cevaplandı: ${runtime.conjAnswered ? "Evet" : "Hayır"}`
    ];
    if (runtime.conjAnswered) {
      if (els.conjFeedbackBanner?.textContent) {
        lines.push(`Sonuç: ${els.conjFeedbackBanner.textContent}`);
      }
      if (verb.ruleTip) lines.push(`Kural: ${verb.ruleTip}`);
      if (verb.principalParts) lines.push(`Temel biçimler: ${verb.principalParts}`);
      if (verb.example?.de) {
        lines.push(`Örnek cümle: ${verb.example.de} (${verb.example.tr || ""})`);
      }
    } else {
      lines.push(`[Gizli Çözüm Bilgisi: ${slot.label.split("/")[0].trim()} ${expected} | Kural: ${verb.ruleTip || "-"}]`);
    }

    return {
      tab: "grammar",
      subTab: "drill",
      answered: runtime.conjAnswered,
      label: `Çekim · ${slot.label.split("/")[0].trim()} ${verb.infinitive}`,
      summary: lines.join("\n")
    };
  }

  if (runtime.activeTab === "dictionary") {
    const query = (els.dictSearch?.value || "").trim();
    const visibleItems = Array.from(
      els.dictList?.querySelectorAll(".dict-item") || []
    )
      .slice(0, 12)
      .map((item) => {
        const de = item.querySelector(".dict-de")?.textContent?.trim() || "";
        const tr = item.querySelector(".dict-tr")?.textContent?.trim() || "";
        return de && tr ? `${de} = ${tr}` : "";
      })
      .filter(Boolean);

    return {
      tab: "dictionary",
      subTab: "dictionary",
      answered: true,
      label: query ? `Sözlük · "${query}"` : "Kelime Sözlüğü",
      summary: [
        `Sekme: Kelime Sözlüğü`,
        `Aktif filtre: ${runtime.dictFilter}${query ? ` | Arama: "${query}"` : ""}`,
        `Sayaç: ${els.dictCount?.textContent || ""}`,
        visibleItems.length > 0
          ? `Ekrandaki ilk öğeler:\n- ${visibleItems.join("\n- ")}`
          : "Eşleşen öğe görünmüyor."
      ].join("\n")
    };
  }

  const word = runtime.currentWord;
  if (!word) {
    return {
      tab: "study",
      subTab: "study",
      answered: false,
      label: "Çalış",
      summary: `Sekme: Çalış (aktif kart yok: ${els.emptyTitle?.textContent || "Boş"})`
    };
  }

  const dirLabel =
    runtime.currentQuestionType === "articles"
      ? "Artikel Pratiği"
      : runtime.currentDirection === "de-tr"
        ? "DE -> TR"
        : "TR -> DE";
  const qLabel =
    runtime.currentQuestionType === "articles"
      ? "Artikel seçimi"
      : runtime.currentQuestionType === "choice"
        ? "Çoktan seçmeli"
        : "Yazmalı";
  const promptText = els.promptTr?.textContent?.trim() || word.tr;
  const solutionText =
    word.category === "noun" ? formatNounSummary(word) : word.de;

  const lines = [
    `Sekme: Çalış (${dirLabel} · ${qLabel})`,
    `Ders: ${word.lesson} | Tür: ${word.category}`,
    `Ekrandaki soru: ${promptText}`,
    `Cevaplandı: ${runtime.answered ? "Evet" : "Hayır"}`
  ];
  if (word.hint) lines.push(`İpucu: ${word.hint}`);

  if (runtime.answered) {
    if (els.feedbackBanner?.textContent) {
      lines.push(`Sonuç: ${els.feedbackBanner.textContent}`);
    }
    if (els.feedbackTip?.textContent && !els.feedbackTip.hidden) {
      lines.push(`Geri bildirim ipucu: ${els.feedbackTip.textContent}`);
    }
    lines.push(`Türkçe: ${word.tr} | Almanca: ${solutionText}`);
    if (word.note) lines.push(`Not: ${word.note}`);
    if (word.example?.de) {
      lines.push(`Örnek: ${word.example.de} (${word.example.tr || ""})`);
    }
  } else {
    lines.push(
      `[Gizli Çözüm Bilgisi: Türkçe="${word.tr}" | Almanca="${solutionText}"${word.note ? ` | Not="${word.note}"` : ""}]`
    );
  }

  const shortPrompt =
    promptText.length > 26 ? `${promptText.slice(0, 25)}…` : promptText;

  return {
    tab: "study",
    subTab: "study",
    answered: runtime.answered,
    label: `Çalış · ${shortPrompt}`,
    summary: lines.join("\n")
  };
}

function init() {
  try {
    applyTheme(getInitialTheme(), false);
    watchSystemTheme();
    if (isSpeechSupported()) {
      resolveGermanVoice();
      if (typeof window.speechSynthesis.addEventListener === "function") {
        window.speechSynthesis.addEventListener("voiceschanged", resolveGermanVoice);
      }
    }
    populateLessonSelects();
    updateUmlautCaseLabels();
    bindEvents();
    aiTutor = initAiTutor({
      getScreenContext: buildAiScreenContext,
      announce
    });
    showNextCard();
    registerServiceWorker();
    window.__deutschkarteReady = true;
    if (loadSyncConfig().token && navigator.onLine) {
      runCloudSync({ manual: false });
    }
  } catch (err) {
    if (els.promptTr) {
      els.promptTr.textContent = "Uygulama başlatılamadı";
    }
    if (els.promptHint) {
      els.promptHint.textContent =
        "Tarayıcı önbelleğini temizleyip sayfayı yenileyin.";
      els.promptHint.hidden = false;
    }
    console.error("DeutschKarte boot error:", err);
  }
}

init();
