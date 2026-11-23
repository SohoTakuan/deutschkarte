export const SYNC_STORAGE_KEY = "deutschkarte_gist_sync_v1";
export const GIST_FILENAME = "deutschkarte-sync.json";
export const GIST_DESCRIPTION = "DeutschKarte ilerleme senkronizasyonu";
const GIST_API_BASE = "https://api.github.com/gists";
const GIST_RAW_ORIGIN = "https://gist.githubusercontent.com";
const VALID_DAILY_GOALS = [10, 20, 30, 50];
const VALID_ROUND_SIZES = ["off", "10", "20", "goal"];
const SYNC_TIMEOUT_MS = 20000;
const MAX_GIST_BYTES = 1024 * 1024;
const TOKEN_PATTERN = /^[\x21-\x7E]{20,256}$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_HISTORY_RETENTION_DAYS = 60;

function toNonNegativeInt(val) {
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

function getLocalDateKeyOffset(daysAgo = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sanitizeDailyHistory(rawHistory) {
  const clean = {};
  if (!rawHistory || typeof rawHistory !== "object" || Array.isArray(rawHistory)) {
    return clean;
  }
  const cutoff = getLocalDateKeyOffset(DAILY_HISTORY_RETENTION_DAYS - 1);
  for (const [dateKey, countVal] of Object.entries(rawHistory)) {
    if (!DATE_KEY_PATTERN.test(dateKey) || dateKey < cutoff) {
      continue;
    }
    const count = toNonNegativeInt(countVal);
    if (count > 0) {
      clean[dateKey] = count;
    }
  }
  return clean;
}

function mergeDailyHistory(localHist, remoteHist) {
  const merged = sanitizeDailyHistory(localHist);
  for (const [dateKey, count] of Object.entries(sanitizeDailyHistory(remoteHist))) {
    if (count > (merged[dateKey] || 0)) {
      merged[dateKey] = count;
    }
  }
  return merged;
}

export function isValidTokenFormat(token) {
  return typeof token === "string" && TOKEN_PATTERN.test(token.trim());
}

export function isValidGistId(gistId) {
  return typeof gistId === "string" && /^[a-fA-F0-9]{8,64}$/.test(gistId.trim());
}

export function loadSyncConfig() {
  if (typeof localStorage === "undefined") {
    return { token: "", gistId: "", lastSyncAt: 0 };
  }
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) {
      return { token: "", gistId: "", lastSyncAt: 0 };
    }
    const parsed = JSON.parse(raw);
    const rawGistId = typeof parsed?.gistId === "string" ? parsed.gistId.trim() : "";
    return {
      token: typeof parsed?.token === "string" ? parsed.token.trim() : "",
      gistId: isValidGistId(rawGistId) ? rawGistId : "",
      lastSyncAt: Number(parsed?.lastSyncAt) || 0
    };
  } catch {
    return { token: "", gistId: "", lastSyncAt: 0 };
  }
}

export function saveSyncConfig(config) {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const rawGistId = String(config?.gistId || "").trim();
    localStorage.setItem(
      SYNC_STORAGE_KEY,
      JSON.stringify({
        token: String(config?.token || "").trim(),
        gistId: isValidGistId(rawGistId) ? rawGistId : "",
        lastSyncAt: Number(config?.lastSyncAt) || 0
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSyncConfig() {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

function sanitizeCardEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const boxNum = Number(entry.box);
  const box = Number.isFinite(boxNum) ? Math.max(1, Math.min(5, Math.floor(boxNum))) : 1;
  const seen = toNonNegativeInt(entry.seen);
  const correct = Math.min(seen, toNonNegativeInt(entry.correct));
  const lastSeenAt = toNonNegativeInt(entry.lastSeenAt);
  const nextReviewAt = toNonNegativeInt(entry.nextReviewAt);
  return { box, seen, correct, lastSeenAt, nextReviewAt };
}

function sanitizeMistakeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return {
    streak: Math.min(1, toNonNegativeInt(entry.streak)),
    misses: Math.max(1, toNonNegativeInt(entry.misses)),
    updatedAt: toNonNegativeInt(entry.updatedAt)
  };
}

function pickNewerCard(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (b.lastSeenAt !== a.lastSeenAt) {
    return b.lastSeenAt > a.lastSeenAt ? b : a;
  }
  if (b.seen !== a.seen) {
    return b.seen > a.seen ? b : a;
  }
  return b.box >= a.box ? b : a;
}

function pickSharedSnapshot(state) {
  return {
    resetAt: Number(state.resetAt) || 0,
    dailyGoal: state.settings?.dailyGoal,
    roundSize: VALID_ROUND_SIZES.includes(state.settings?.roundSize)
      ? state.settings.roundSize
      : "off",
    autoSpeak: Boolean(state.settings?.autoSpeak),
    progress: state.progress,
    daily: {
      date: state.daily?.date || "",
      count: Number(state.daily?.count) || 0,
      streakDays: Number(state.daily?.streakDays) || 0,
      lastCompletedDate: state.daily?.lastCompletedDate || null
    },
    dailyHistory: sanitizeDailyHistory(state.dailyHistory),
    cards: state.cards || {},
    mistakes: state.mistakes || {},
    mistakeClearedAt: state.mistakeClearedAt || {},
    hiddenWords: state.hiddenWords || {},
    hiddenRestoredAt: state.hiddenRestoredAt || {}
  };
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

function sanitizeTimestampMap(rawMap, validWordIds) {
  const clean = {};
  if (!rawMap || typeof rawMap !== "object") {
    return clean;
  }
  for (const [id, ts] of Object.entries(rawMap)) {
    const num = Number(ts);
    if (validWordIds.has(id) && Number.isFinite(num) && num > 0) {
      clean[id] = num;
    }
  }
  return clean;
}

function mergeHiddenState(
  localHidden,
  localRestored,
  remoteHidden,
  remoteRestored,
  validWordIds
) {
  const mergedRestoredAt = sanitizeTimestampMap(localRestored, validWordIds);
  for (const [id, num] of Object.entries(
    sanitizeTimestampMap(remoteRestored, validWordIds)
  )) {
    if (num > (mergedRestoredAt[id] || 0)) {
      mergedRestoredAt[id] = num;
    }
  }

  const candidateHidden = sanitizeTimestampMap(localHidden, validWordIds);
  for (const [id, num] of Object.entries(
    sanitizeTimestampMap(remoteHidden, validWordIds)
  )) {
    if (num > (candidateHidden[id] || 0)) {
      candidateHidden[id] = num;
    }
  }

  const mergedHiddenWords = {};
  for (const [id, num] of Object.entries(candidateHidden)) {
    if (num > (mergedRestoredAt[id] || 0)) {
      mergedHiddenWords[id] = num;
    }
  }

  return { mergedHiddenWords, mergedRestoredAt };
}

export function mergeStates(localState, remoteState, validWordIds, normalizeDailyFn) {
  const normalizeDaily =
    typeof normalizeDailyFn === "function"
      ? normalizeDailyFn
      : (d) => ({
          date: typeof d?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : "",
          count: toNonNegativeInt(d?.count),
          streakDays: toNonNegativeInt(d?.streakDays),
          lastCompletedDate:
            typeof d?.lastCompletedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.lastCompletedDate)
              ? d.lastCompletedDate
              : null
        });

  if (!remoteState || typeof remoteState !== "object") {
    return {
      mergedState: localState,
      localChanged: false,
      remoteNeedsPush: true
    };
  }

  const localUpdatedAt = toNonNegativeInt(localState.updatedAt);
  const remoteUpdatedAt = toNonNegativeInt(remoteState.updatedAt);
  const localResetAt = toNonNegativeInt(localState.resetAt);
  const remoteResetAt = toNonNegativeInt(remoteState.resetAt);
  const remoteGoalNum = Number(remoteState.settings?.dailyGoal);
  const safeRemoteGoal = VALID_DAILY_GOALS.includes(remoteGoalNum) ? remoteGoalNum : null;
  const safeRemoteRoundSize = VALID_ROUND_SIZES.includes(remoteState.settings?.roundSize)
    ? remoteState.settings.roundSize
    : null;

  // Explicit reset dominance: if one side reset more recently than the other side's last edit
  if (remoteResetAt > localUpdatedAt && remoteResetAt >= localResetAt) {
    const {
      mergedHiddenWords: adoptedHiddenWords,
      mergedRestoredAt: adoptedHiddenRestoredAt
    } = mergeHiddenState(
      remoteState.hiddenWords,
      remoteState.hiddenRestoredAt,
      null,
      null,
      validWordIds
    );
    const adoptedTotalAnswered = toNonNegativeInt(remoteState.progress?.totalAnswered);
    const adopted = {
      settings: {
        ...localState.settings,
        dailyGoal: safeRemoteGoal ?? localState.settings.dailyGoal,
        roundSize: safeRemoteRoundSize ?? localState.settings.roundSize ?? "off",
        autoSpeak:
          typeof remoteState.settings?.autoSpeak === "boolean"
            ? remoteState.settings.autoSpeak
            : localState.settings.autoSpeak,
        keepAiOpen:
          typeof remoteState.settings?.keepAiOpen === "boolean"
            ? remoteState.settings.keepAiOpen
            : Boolean(localState.settings.keepAiOpen)
      },
      progress: {
        totalAnswered: adoptedTotalAnswered,
        totalCorrect: Math.min(
          adoptedTotalAnswered,
          toNonNegativeInt(remoteState.progress?.totalCorrect)
        ),
        bestStreak: toNonNegativeInt(remoteState.progress?.bestStreak)
      },
      daily: normalizeDaily(remoteState.daily),
      dailyHistory: sanitizeDailyHistory(remoteState.dailyHistory),
      cards: {},
      mistakes: {},
      mistakeClearedAt: {},
      hiddenWords: adoptedHiddenWords,
      hiddenRestoredAt: adoptedHiddenRestoredAt,
      updatedAt: remoteUpdatedAt,
      resetAt: remoteResetAt
    };

    for (const [id, entry] of Object.entries(remoteState.cards || {})) {
      if (validWordIds.has(id)) {
        const clean = sanitizeCardEntry(entry);
        if (clean) adopted.cards[id] = clean;
      }
    }
    for (const [id, ts] of Object.entries(remoteState.mistakeClearedAt || {})) {
      const tsNum = Number(ts);
      if (validWordIds.has(id) && Number.isFinite(tsNum) && tsNum > 0) {
        adopted.mistakeClearedAt[id] = tsNum;
      }
    }
    for (const [id, entry] of Object.entries(remoteState.mistakes || {})) {
      if (validWordIds.has(id)) {
        const clean = sanitizeMistakeEntry(entry);
        if (clean && clean.updatedAt > (adopted.mistakeClearedAt[id] || 0)) {
          adopted.mistakes[id] = clean;
        }
      }
    }

    const localChanged =
      stableStringify(pickSharedSnapshot(adopted)) !==
      stableStringify(pickSharedSnapshot(localState));
    return { mergedState: adopted, localChanged, remoteNeedsPush: false };
  }

  if (localResetAt > remoteUpdatedAt && localResetAt > remoteResetAt) {
    return {
      mergedState: localState,
      localChanged: false,
      remoteNeedsPush: true
    };
  }

  // Merge cards per wordId (newest lastSeenAt wins)
  const mergedCards = {};
  const allCardIds = new Set([
    ...Object.keys(localState.cards || {}),
    ...Object.keys(remoteState.cards || {})
  ]);
  for (const id of allCardIds) {
    if (!validWordIds.has(id)) continue;
    const localCard = sanitizeCardEntry(localState.cards?.[id]);
    const remoteCard = sanitizeCardEntry(remoteState.cards?.[id]);
    const winner = pickNewerCard(localCard, remoteCard);
    if (winner) {
      mergedCards[id] = winner;
    }
  }

  // Merge mistake tombstones + active mistakes
  const mergedClearedAt = {};
  const allClearedIds = new Set([
    ...Object.keys(localState.mistakeClearedAt || {}),
    ...Object.keys(remoteState.mistakeClearedAt || {})
  ]);
  for (const id of allClearedIds) {
    if (!validWordIds.has(id)) continue;
    const ts = Math.max(
      Number(localState.mistakeClearedAt?.[id]) || 0,
      Number(remoteState.mistakeClearedAt?.[id]) || 0
    );
    if (ts > 0) {
      mergedClearedAt[id] = ts;
    }
  }

  const mergedMistakes = {};
  const allMistakeIds = new Set([
    ...Object.keys(localState.mistakes || {}),
    ...Object.keys(remoteState.mistakes || {})
  ]);
  for (const id of allMistakeIds) {
    if (!validWordIds.has(id)) continue;
    const localM = sanitizeMistakeEntry(localState.mistakes?.[id]);
    const remoteM = sanitizeMistakeEntry(remoteState.mistakes?.[id]);
    let chosen = null;
    if (localM && remoteM) {
      chosen = remoteM.updatedAt > localM.updatedAt ? remoteM : localM;
    } else {
      chosen = localM || remoteM;
    }
    if (chosen && chosen.updatedAt > (mergedClearedAt[id] || 0)) {
      mergedMistakes[id] = chosen;
    }
  }

  // Merge daily progress
  const localDaily = normalizeDaily(localState.daily);
  const remoteDaily = normalizeDaily(remoteState.daily);
  let latestCompleted = localDaily.lastCompletedDate;
  if (
    remoteDaily.lastCompletedDate &&
    (!latestCompleted || remoteDaily.lastCompletedDate > latestCompleted)
  ) {
    latestCompleted = remoteDaily.lastCompletedDate;
  }
  const mergedDaily = {
    date: localDaily.date,
    count: Math.max(localDaily.count, remoteDaily.count),
    streakDays: Math.max(localDaily.streakDays, remoteDaily.streakDays),
    lastCompletedDate: latestCompleted || null,
    goalCelebratedDate:
      localDaily.goalCelebratedDate || remoteDaily.goalCelebratedDate || null
  };

  // Merge cumulative progress
  const localAnswered = toNonNegativeInt(localState.progress?.totalAnswered);
  const remoteAnswered = toNonNegativeInt(remoteState.progress?.totalAnswered);
  const localCorrect = toNonNegativeInt(localState.progress?.totalCorrect);
  const remoteCorrect = toNonNegativeInt(remoteState.progress?.totalCorrect);

  let mergedAnswered = Math.max(localAnswered, remoteAnswered);
  let mergedCorrect = Math.max(localCorrect, remoteCorrect);
  // If remote has newer total stats than local and no overlap info, keep consistent upper bound
  mergedCorrect = Math.min(mergedAnswered, mergedCorrect);

  const mergedBestStreak = Math.max(
    toNonNegativeInt(localState.progress?.bestStreak),
    toNonNegativeInt(remoteState.progress?.bestStreak)
  );

  // Preserve current device's active study UI mode/lesson/direction, sync preferences from newer edit
  const preferRemotePrefs = remoteUpdatedAt > localUpdatedAt;
  const mergedSettings = {
    ...localState.settings,
    dailyGoal: preferRemotePrefs
      ? safeRemoteGoal ?? localState.settings.dailyGoal
      : localState.settings.dailyGoal,
    roundSize: preferRemotePrefs
      ? safeRemoteRoundSize ?? localState.settings.roundSize ?? "off"
      : localState.settings.roundSize ?? "off",
    autoSpeak:
      preferRemotePrefs && typeof remoteState.settings?.autoSpeak === "boolean"
        ? remoteState.settings.autoSpeak
        : localState.settings.autoSpeak,
    keepAiOpen:
      preferRemotePrefs && typeof remoteState.settings?.keepAiOpen === "boolean"
        ? remoteState.settings.keepAiOpen
        : Boolean(localState.settings.keepAiOpen)
  };

  const { mergedHiddenWords, mergedRestoredAt } = mergeHiddenState(
    localState.hiddenWords,
    localState.hiddenRestoredAt,
    remoteState.hiddenWords,
    remoteState.hiddenRestoredAt,
    validWordIds
  );

  const mergedDailyHistory = mergeDailyHistory(
    localState.dailyHistory,
    remoteState.dailyHistory
  );
  if (mergedDaily.date && mergedDaily.count > 0) {
    mergedDailyHistory[mergedDaily.date] = Math.max(
      mergedDailyHistory[mergedDaily.date] || 0,
      mergedDaily.count
    );
  }

  const mergedState = {
    settings: mergedSettings,
    progress: {
      totalAnswered: mergedAnswered,
      totalCorrect: mergedCorrect,
      bestStreak: mergedBestStreak
    },
    daily: mergedDaily,
    dailyHistory: mergedDailyHistory,
    cards: mergedCards,
    mistakes: mergedMistakes,
    mistakeClearedAt: mergedClearedAt,
    hiddenWords: mergedHiddenWords,
    hiddenRestoredAt: mergedRestoredAt,
    updatedAt: Math.max(localUpdatedAt, remoteUpdatedAt),
    resetAt: Math.max(localResetAt, remoteResetAt)
  };

  const mergedSnap = stableStringify(pickSharedSnapshot(mergedState));
  const localSnap = stableStringify(pickSharedSnapshot(localState));
  const remoteSnap = stableStringify(
    pickSharedSnapshot({
      ...remoteState,
      daily: remoteDaily
    })
  );

  return {
    mergedState,
    localChanged: mergedSnap !== localSnap,
    remoteNeedsPush: mergedSnap !== remoteSnap
  };
}

export class SyncHttpError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "SyncHttpError";
    this.status = status;
  }
}

async function githubGistRequest(url, token, options = {}) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new SyncHttpError("GitHub senkronizasyon isteği zaman aşımına uğradı.", 0);
    }
    throw new SyncHttpError(
      "İnternet bağlantısı yok. Çevrimiçi olunca ilerlemeniz otomatik eşitlenecek.",
      0
    );
  } finally {
    clearTimeout(timerId);
  }

  if (response.status === 401) {
    throw new SyncHttpError("GitHub token geçersiz veya süresi dolmuş.", 401);
  }
  if (response.status === 403) {
    throw new SyncHttpError(
      "Token'ın 'gist' izni eksik veya istek sınırı doldu. Classic token oluştururken 'gist' kutucuğunu işaretleyin.",
      403
    );
  }
  if (response.status === 404) {
    throw new SyncHttpError("Gist bulunamadı.", 404);
  }
  if (!response.ok) {
    throw new SyncHttpError(
      `GitHub senkronizasyon hatası (HTTP ${response.status}).`,
      response.status
    );
  }

  return response.json();
}

export async function findExistingSyncGist(token) {
  const gists = await githubGistRequest(`${GIST_API_BASE}?per_page=100`, token, {
    method: "GET"
  });
  if (!Array.isArray(gists)) {
    return null;
  }
  return gists.find((gist) => gist?.files && gist.files[GIST_FILENAME]) || null;
}

export async function fetchSyncGistContent(token, gistId) {
  if (!isValidGistId(gistId)) {
    throw new SyncHttpError("Gist bulunamadı.", 404);
  }
  const gist = await githubGistRequest(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, token, {
    method: "GET"
  });
  const file = gist?.files?.[GIST_FILENAME];
  if (!file) {
    return null;
  }

  let rawText = file.content;
  if ((file.truncated || typeof rawText !== "string") && file.raw_url) {
    let rawOrigin = "";
    try {
      rawOrigin = new URL(file.raw_url).origin;
    } catch {
      rawOrigin = "";
    }
    if (rawOrigin !== GIST_RAW_ORIGIN) {
      throw new SyncHttpError("Güvenilmeyen Gist içerik kaynağı reddedildi.", 0);
    }
    const rawController = new AbortController();
    const rawTimer = setTimeout(() => rawController.abort(), SYNC_TIMEOUT_MS);
    let rawResp;
    try {
      rawResp = await fetch(file.raw_url, {
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: rawController.signal
      });
    } catch {
      throw new SyncHttpError("Gist içeriği indirilemedi veya zaman aşımına uğradı.", 0);
    } finally {
      clearTimeout(rawTimer);
    }
    if (!rawResp.ok) {
      throw new SyncHttpError("Gist içeriği indirilemedi.", rawResp.status);
    }
    rawText = await rawResp.text();
  }

  if (!rawText || rawText.length > MAX_GIST_BYTES) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || parsed.app !== "DeutschKarte") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildRemotePayload(state) {
  return {
    app: "DeutschKarte",
    syncVersion: 1,
    syncedAt: new Date().toISOString(),
    updatedAt: Number(state.updatedAt) || 0,
    resetAt: Number(state.resetAt) || 0,
    settings: {
      dailyGoal: state.settings.dailyGoal,
      roundSize: VALID_ROUND_SIZES.includes(state.settings?.roundSize)
        ? state.settings.roundSize
        : "off",
      autoSpeak: Boolean(state.settings.autoSpeak)
    },
    progress: state.progress,
    daily: state.daily,
    dailyHistory: sanitizeDailyHistory(state.dailyHistory),
    cards: state.cards,
    mistakes: state.mistakes,
    mistakeClearedAt: state.mistakeClearedAt || {},
    hiddenWords: state.hiddenWords || {},
    hiddenRestoredAt: state.hiddenRestoredAt || {}
  };
}

export async function createSyncGist(token, state) {
  const payload = buildRemotePayload(state);
  const created = await githubGistRequest(GIST_API_BASE, token, {
    method: "POST",
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(payload, null, 2)
        }
      }
    })
  });
  return created.id;
}

export async function updateSyncGist(token, gistId, state) {
  if (!isValidGistId(gistId)) {
    throw new SyncHttpError("Gist kimliği geçersiz.", 404);
  }
  const payload = buildRemotePayload(state);
  await githubGistRequest(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(payload, null, 2)
        }
      }
    })
  });
}

export async function syncWithGitHubGist({
  token,
  gistId,
  localState,
  validWordIds,
  normalizeDailyFn
}) {
  const cleanToken = String(token || "").trim();
  if (!isValidTokenFormat(cleanToken)) {
    throw new SyncHttpError(
      "Lütfen boşluksuz, yalnızca ASCII karakterlerden oluşan geçerli bir GitHub token'ı girin.",
      0
    );
  }

  let activeGistId = String(gistId || "").trim();
  let remoteState = null;
  let foundExisting = false;

  if (activeGistId) {
    try {
      remoteState = await fetchSyncGistContent(cleanToken, activeGistId);
      foundExisting = true;
    } catch (err) {
      if (err instanceof SyncHttpError && err.status === 404) {
        activeGistId = "";
      } else {
        throw err;
      }
    }
  }

  if (!activeGistId) {
    const existing = await findExistingSyncGist(cleanToken);
    if (existing?.id) {
      activeGistId = existing.id;
      remoteState = await fetchSyncGistContent(cleanToken, activeGistId);
      foundExisting = true;
    }
  }

  if (!foundExisting) {
    const newGistId = await createSyncGist(cleanToken, localState);
    return {
      gistId: newGistId,
      mergedState: localState,
      localChanged: false,
      action: "created"
    };
  }

  const { mergedState, localChanged, remoteNeedsPush } = mergeStates(
    localState,
    remoteState,
    validWordIds,
    normalizeDailyFn
  );

  if (remoteNeedsPush || !remoteState) {
    await updateSyncGist(cleanToken, activeGistId, mergedState);
  }

  return {
    gistId: activeGistId,
    mergedState,
    localChanged,
    action: "synced"
  };
}
