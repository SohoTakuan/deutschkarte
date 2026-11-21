export const SYNC_STORAGE_KEY = "deutschkarte_gist_sync_v1";
export const GIST_FILENAME = "deutschkarte-sync.json";
export const GIST_DESCRIPTION = "DeutschKarte ilerleme senkronizasyonu";
const GIST_API_BASE = "https://api.github.com/gists";

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
    return {
      token: typeof parsed?.token === "string" ? parsed.token.trim() : "",
      gistId: typeof parsed?.gistId === "string" ? parsed.gistId.trim() : "",
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
    localStorage.setItem(
      SYNC_STORAGE_KEY,
      JSON.stringify({
        token: String(config?.token || "").trim(),
        gistId: String(config?.gistId || "").trim(),
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
  const box = Math.max(1, Math.min(5, Math.floor(Number(entry.box) || 1)));
  const seen = Math.max(0, Math.floor(Number(entry.seen) || 0));
  const correct = Math.min(seen, Math.max(0, Math.floor(Number(entry.correct) || 0)));
  const lastSeenAt = Math.max(0, Number(entry.lastSeenAt) || 0);
  const nextReviewAt = Math.max(0, Number(entry.nextReviewAt) || 0);
  return { box, seen, correct, lastSeenAt, nextReviewAt };
}

function sanitizeMistakeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return {
    streak: Math.max(0, Math.min(1, Math.floor(Number(entry.streak) || 0))),
    misses: Math.max(1, Math.floor(Number(entry.misses) || 1)),
    updatedAt: Math.max(0, Number(entry.updatedAt) || 0)
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
    autoSpeak: Boolean(state.settings?.autoSpeak),
    progress: state.progress,
    daily: {
      date: state.daily?.date || "",
      count: Number(state.daily?.count) || 0,
      streakDays: Number(state.daily?.streakDays) || 0,
      lastCompletedDate: state.daily?.lastCompletedDate || null
    },
    cards: state.cards || {},
    mistakes: state.mistakes || {},
    mistakeClearedAt: state.mistakeClearedAt || {}
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

export function mergeStates(localState, remoteState, validWordIds, normalizeDailyFn) {
  const normalizeDaily =
    typeof normalizeDailyFn === "function"
      ? normalizeDailyFn
      : (d) => ({
          date: d?.date || "",
          count: Math.max(0, Number(d?.count) || 0),
          streakDays: Math.max(0, Number(d?.streakDays) || 0),
          lastCompletedDate: d?.lastCompletedDate || null
        });

  if (!remoteState || typeof remoteState !== "object") {
    return {
      mergedState: localState,
      localChanged: false,
      remoteNeedsPush: true
    };
  }

  const localUpdatedAt = Math.max(0, Number(localState.updatedAt) || 0);
  const remoteUpdatedAt = Math.max(0, Number(remoteState.updatedAt) || 0);
  const localResetAt = Math.max(0, Number(localState.resetAt) || 0);
  const remoteResetAt = Math.max(0, Number(remoteState.resetAt) || 0);

  // Explicit reset dominance: if one side reset more recently than the other side's last edit
  if (remoteResetAt > localUpdatedAt && remoteResetAt >= localResetAt) {
    const adopted = {
      settings: {
        ...localState.settings,
        dailyGoal: Number(remoteState.settings?.dailyGoal) || localState.settings.dailyGoal,
        autoSpeak:
          typeof remoteState.settings?.autoSpeak === "boolean"
            ? remoteState.settings.autoSpeak
            : localState.settings.autoSpeak
      },
      progress: {
        totalAnswered: Math.max(0, Number(remoteState.progress?.totalAnswered) || 0),
        totalCorrect: Math.min(
          Math.max(0, Number(remoteState.progress?.totalAnswered) || 0),
          Math.max(0, Number(remoteState.progress?.totalCorrect) || 0)
        ),
        bestStreak: Math.max(0, Number(remoteState.progress?.bestStreak) || 0)
      },
      daily: normalizeDaily(remoteState.daily),
      cards: {},
      mistakes: {},
      mistakeClearedAt: {},
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
      if (validWordIds.has(id) && Number(ts) > 0) {
        adopted.mistakeClearedAt[id] = Number(ts);
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
    lastCompletedDate: latestCompleted || null
  };

  // Merge cumulative progress
  const localAnswered = Math.max(0, Number(localState.progress?.totalAnswered) || 0);
  const remoteAnswered = Math.max(0, Number(remoteState.progress?.totalAnswered) || 0);
  const localCorrect = Math.max(0, Number(localState.progress?.totalCorrect) || 0);
  const remoteCorrect = Math.max(0, Number(remoteState.progress?.totalCorrect) || 0);

  let mergedAnswered = Math.max(localAnswered, remoteAnswered);
  let mergedCorrect = Math.max(localCorrect, remoteCorrect);
  // If remote has newer total stats than local and no overlap info, keep consistent upper bound
  mergedCorrect = Math.min(mergedAnswered, mergedCorrect);

  const mergedBestStreak = Math.max(
    Math.max(0, Number(localState.progress?.bestStreak) || 0),
    Math.max(0, Number(remoteState.progress?.bestStreak) || 0)
  );

  // Preserve current device's active study UI mode/lesson/direction, sync goal/autoSpeak from newer edit
  const preferRemotePrefs = remoteUpdatedAt > localUpdatedAt;
  const mergedSettings = {
    ...localState.settings,
    dailyGoal: preferRemotePrefs
      ? Number(remoteState.settings?.dailyGoal) || localState.settings.dailyGoal
      : localState.settings.dailyGoal,
    autoSpeak: preferRemotePrefs && typeof remoteState.settings?.autoSpeak === "boolean"
      ? remoteState.settings.autoSpeak
      : localState.settings.autoSpeak
  };

  const mergedState = {
    settings: mergedSettings,
    progress: {
      totalAnswered: mergedAnswered,
      totalCorrect: mergedCorrect,
      bestStreak: mergedBestStreak
    },
    daily: mergedDaily,
    cards: mergedCards,
    mistakes: mergedMistakes,
    mistakeClearedAt: mergedClearedAt,
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
  let response;
  try {
    response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new SyncHttpError(
      "İnternet bağlantısı yok. Çevrimdışı olunca ilerlemeniz otomatik eşitlenecek.",
      0
    );
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
  const gist = await githubGistRequest(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, token, {
    method: "GET"
  });
  const file = gist?.files?.[GIST_FILENAME];
  if (!file) {
    return null;
  }

  let rawText = file.content;
  if ((file.truncated || typeof rawText !== "string") && file.raw_url) {
    const rawResp = await fetch(file.raw_url, { cache: "no-store" });
    if (!rawResp.ok) {
      throw new SyncHttpError("Gist içeriği indirilemedi.", rawResp.status);
    }
    rawText = await rawResp.text();
  }

  if (!rawText) {
    return null;
  }
  try {
    return JSON.parse(rawText);
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
      autoSpeak: Boolean(state.settings.autoSpeak)
    },
    progress: state.progress,
    daily: state.daily,
    cards: state.cards,
    mistakes: state.mistakes,
    mistakeClearedAt: state.mistakeClearedAt || {}
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
  if (!cleanToken) {
    throw new SyncHttpError("Lütfen geçerli bir GitHub token'ı girin.", 0);
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
