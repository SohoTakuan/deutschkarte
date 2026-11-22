const AI_STORAGE_KEY = "deutschkarte_ai_tutor_v1";
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];
const DEFAULT_MODEL = GEMINI_MODELS[0];
const MAX_HISTORY_TURNS = 10;
const MAX_PROMPT_LENGTH = 1500;
const REQUEST_TIMEOUT_MS = 15000;
const CREDENTIAL_PATTERN = /^[\x21-\x7E]{20,256}$/;
let preferredModelIndex = 0;

function isValidApiKeyFormat(key) {
  return typeof key === "string" && CREDENTIAL_PATTERN.test(key.trim());
}

function sanitizeUpstreamError(message, apiKey) {
  let clean = String(message || "").trim();
  if (apiKey) {
    clean = clean.split(apiKey).join("[gizli]");
  }
  clean = clean.replace(/AIza[A-Za-z0-9_-]{10,}/g, "[gizli]");
  if (clean.length > 180) {
    clean = `${clean.slice(0, 179)}…`;
  }
  return clean;
}

const SYSTEM_INSTRUCTION = [
  "DeutschKarte kullanıcısına Almanca sorularında doğrudan ve net Türkçe ile yardımcı ol.",
  "Rol yapma, kendini tanıtma veya emoji kullanma; kısa, samimi ve mobil ekranda rahat okunan cevaplar ver.",
  "Sana kullanıcının şu an ekranda gördüğü kart, çekim sorusu, not veya sözlük bağlamı verilir; açıklamalarını doğrudan bu anlık ekrana dayandır.",
  "Eğer bağlamda 'Cevaplandı: Hayır' yazıyorsa ve kullanıcı cevabı doğrudan istemediyse önce kısa bir ipucu ver; 'Cevaplandı: Evet' ise neden öyle olduğunu netçe açıkla.",
  "Almanca kelimelerde büyük/küçük harf, ä/ö/ü/ß ve Duden yazımına uy; emin olmadığın bir bilgiyi uydurma."
].join(" ");

function parseStoredAiConfig(raw, fallbackSessionOnly) {
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw);
  const rawKey = typeof parsed?.apiKey === "string" ? parsed.apiKey.trim() : "";
  const apiKey = isValidApiKeyFormat(rawKey) ? rawKey : "";
  const model = GEMINI_MODELS.includes(parsed?.model) ? parsed.model : DEFAULT_MODEL;
  const sessionOnly =
    typeof parsed?.sessionOnly === "boolean" ? parsed.sessionOnly : fallbackSessionOnly;
  return { apiKey, model, sessionOnly };
}

function loadAiConfig() {
  try {
    const sessionCfg = parseStoredAiConfig(
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem(AI_STORAGE_KEY) : null,
      true
    );
    if (sessionCfg) {
      return sessionCfg;
    }
    const localCfg = parseStoredAiConfig(
      typeof localStorage !== "undefined" ? localStorage.getItem(AI_STORAGE_KEY) : null,
      false
    );
    if (localCfg) {
      return localCfg;
    }
    return { apiKey: "", model: DEFAULT_MODEL, sessionOnly: false };
  } catch {
    return { apiKey: "", model: DEFAULT_MODEL, sessionOnly: false };
  }
}

function saveAiConfig(config) {
  const rawKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  const sessionOnly = Boolean(config.sessionOnly);
  const safe = {
    apiKey: isValidApiKeyFormat(rawKey) ? rawKey : "",
    model: GEMINI_MODELS.includes(config.model) ? config.model : DEFAULT_MODEL,
    sessionOnly
  };
  try {
    const serialized = JSON.stringify(safe);
    if (sessionOnly) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(AI_STORAGE_KEY, serialized);
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AI_STORAGE_KEY);
      }
    } else {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(AI_STORAGE_KEY, serialized);
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(AI_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage quota errors
  }
  return safe;
}

function removeAiApiKey(currentModel, sessionOnly = false) {
  const safe = {
    apiKey: "",
    model: GEMINI_MODELS.includes(currentModel) ? currentModel : DEFAULT_MODEL,
    sessionOnly: Boolean(sessionOnly)
  };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(AI_STORAGE_KEY);
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(AI_STORAGE_KEY);
    }
  } catch {
    // Ignore storage removal errors
  }
  return safe;
}

function appendInlineFormatted(parent, text) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.appendChild(strong);
    } else if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      const em = document.createElement("em");
      em.textContent = token.slice(1, -1);
      parent.appendChild(em);
    } else if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      parent.appendChild(code);
    } else {
      parent.appendChild(document.createTextNode(token));
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function renderFormattedText(container, text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) {
      container.appendChild(document.createElement("br"));
    }
    appendInlineFormatted(container, line);
  });
}

function getQuickChipsForContext(ctx) {
  if (!ctx) {
    return ["Bu konuyu kısaca özetle", "1 örnek cümle kur"];
  }
  if (ctx.tab === "study") {
    if (ctx.answered) {
      return [
        "Burada neden böyle oldu?",
        "Artikeli veya yapıyı nasıl hatırlarım?",
        "2 kısa A1 örnek cümle ver"
      ];
    }
    return [
      "Cevabı söylemeden ipucu ver",
      "Bu kelimenin/kalıbın mantığı ne?"
    ];
  }
  if (ctx.tab === "grammar") {
    if (ctx.subTab === "notes") {
      return [
        "Bu tablodaki kuralı basitçe özetle",
        "Bana bu kuraldan 1 soru sor"
      ];
    }
    if (ctx.answered) {
      return [
        "Bu çekim neden böyle oldu?",
        "Benzer çekilen 2 fiil örneği ver"
      ];
    }
    return [
      "Cevabı söylemeden kural ipucu ver",
      "Bu fiilin kökü nasıl değişiyor?"
    ];
  }
  return [
    "Bu listedeki kelimelerden mini tekrar yap",
    "Aradaki farkı ve kullanımı açıkla"
  ];
}

async function requestSingleModel({ model, apiKey, contents }) {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 700
          }
        }),
        signal: controller.signal
      }
    );
  } catch (err) {
    if (err?.name === "AbortError") {
      return {
        ok: false,
        retryable: true,
        status: 0,
        error: new Error("Yanıt zaman aşımına uğradı. Lütfen tekrar deneyin.")
      };
    }
    return {
      ok: false,
      retryable: false,
      status: 0,
      error: new Error("Gemini API sunucusuna ulaşılamadı. Bağlantınızı kontrol edin.")
    };
  } finally {
    window.clearTimeout(timerId);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return {
        ok: false,
        retryable: false,
        status: response.status,
        error: new Error("API anahtarı geçersiz veya yetkisiz. Ayarlardan Gemini API anahtarınızı kontrol edin.")
      };
    }
    const retryable = [404, 429, 500, 502, 503, 504].includes(response.status);
    if (response.status === 429) {
      return {
        ok: false,
        retryable: true,
        status: 429,
        error: new Error("Ücretsiz kullanım istek sınırına ulaşıldı. Biraz bekleyip tekrar deneyin.")
      };
    }
    if (response.status === 503) {
      return {
        ok: false,
        retryable: true,
        status: 503,
        error: new Error("Gemini sunucuları şu an yoğun (503). Birkaç saniye sonra tekrar deneyin.")
      };
    }
    const apiMessage = sanitizeUpstreamError(data?.error?.message, apiKey);
    return {
      ok: false,
      retryable,
      status: response.status,
      error: new Error(
        apiMessage
          ? `Gemini hatası (${response.status}): ${apiMessage}`
          : `Gemini isteği başarısız oldu (${response.status}).`
      )
    };
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const reply = Array.isArray(parts)
    ? parts
        .map((p) => (typeof p?.text === "string" ? p.text : ""))
        .join("")
        .trim()
    : "";

  if (!reply) {
    return {
      ok: false,
      retryable: true,
      status: 200,
      error: new Error("Modelden boş yanıt döndü. Soruyu biraz daha net yazıp tekrar deneyin.")
    };
  }

  return { ok: true, reply };
}

async function requestGeminiReply({ apiKey, history, screenContext }) {
  if (!navigator.onLine) {
    throw new Error("İnternet bağlantısı yok. Çevrimiçi olduğunuzda tekrar deneyin veya üstteki düğmeyle bağlamı kopyalayın.");
  }

  const recent = history.slice(-MAX_HISTORY_TURNS);
  const contents = recent.map((msg, idx) => {
    const isLatestUser = idx === recent.length - 1 && msg.role === "user";
    const text = isLatestUser
      ? `[Anlık Ekran Bağlamı]\n${screenContext.summary}\n\n[Öğrencinin Sorusu]\n${msg.text}`
      : msg.text;
    return {
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text }]
    };
  });

  const orderedModels = [];
  for (let i = 0; i < GEMINI_MODELS.length; i += 1) {
    const idx = (preferredModelIndex + i) % GEMINI_MODELS.length;
    orderedModels.push(GEMINI_MODELS[idx]);
  }

  let lastError = null;
  for (const model of orderedModels) {
    const result = await requestSingleModel({ model, apiKey, contents });
    if (result.ok) {
      preferredModelIndex = GEMINI_MODELS.indexOf(model);
      return result.reply;
    }
    lastError = result.error;
    if (!result.retryable) {
      throw lastError;
    }
  }

  throw lastError || new Error("Gemini yanıtı alınamadı.");
}

export function initAiTutor({ getScreenContext, announce }) {
  const dom = {
    fab: document.getElementById("ai-fab"),
    backdrop: document.getElementById("ai-backdrop"),
    drawer: document.getElementById("ai-drawer"),
    contextLabel: document.getElementById("ai-context-label"),
    btnCopyContext: document.getElementById("ai-btn-copy-context"),
    btnClear: document.getElementById("ai-btn-clear"),
    btnSettings: document.getElementById("ai-btn-settings"),
    btnClose: document.getElementById("ai-btn-close"),
    settingsPanel: document.getElementById("ai-settings-panel"),
    apiKeyInput: document.getElementById("ai-api-key"),
    sessionOnlyCheck: document.getElementById("ai-session-only"),
    modelSelect: document.getElementById("ai-model-select"),
    btnSaveKey: document.getElementById("ai-btn-save-key"),
    btnRemoveKey: document.getElementById("ai-btn-remove-key"),
    settingsStatus: document.getElementById("ai-settings-status"),
    messages: document.getElementById("ai-messages"),
    quickChips: document.getElementById("ai-quick-chips"),
    input: document.getElementById("ai-input"),
    btnSend: document.getElementById("ai-btn-send")
  };

  if (!dom.fab || !dom.drawer || !dom.messages || !dom.input) {
    return {
      open: () => {},
      close: () => {},
      isOpen: () => false,
      refreshContext: () => {}
    };
  }

  let config = loadAiConfig();
  const initialModelIdx = GEMINI_MODELS.indexOf(config.model);
  if (initialModelIdx >= 0) {
    preferredModelIndex = initialModelIdx;
  }
  let isDrawerOpen = false;
  let settingsOpen = !config.apiKey;
  let isLoading = false;
  let statusTimer = null;
  let history = [];

  function setStatus(text, tone = "neutral") {
    if (!dom.settingsStatus) {
      return;
    }
    if (statusTimer) {
      window.clearTimeout(statusTimer);
      statusTimer = null;
    }
    dom.settingsStatus.textContent = text;
    dom.settingsStatus.dataset.tone = tone;
    dom.settingsStatus.hidden = !text;
    if (text && tone === "ok") {
      statusTimer = window.setTimeout(() => {
        if (dom.settingsStatus) {
          dom.settingsStatus.hidden = true;
        }
      }, 3500);
    }
  }

  function syncSettingsUI() {
    if (dom.modelSelect) {
      dom.modelSelect.value = config.model;
    }
    if (dom.sessionOnlyCheck) {
      dom.sessionOnlyCheck.checked = Boolean(config.sessionOnly);
    }
    if (dom.apiKeyInput) {
      dom.apiKeyInput.value = "";
      dom.apiKeyInput.placeholder = config.apiKey
        ? "Kayıtlı anahtar mevcut (değiştirmek için yenisini girin)"
        : "AIza...";
    }
    if (dom.btnRemoveKey) {
      dom.btnRemoveKey.hidden = !config.apiKey;
    }
    if (dom.settingsPanel) {
      dom.settingsPanel.hidden = !settingsOpen;
    }
    if (dom.btnSettings) {
      dom.btnSettings.classList.toggle("is-active", settingsOpen);
      dom.btnSettings.setAttribute("aria-pressed", String(settingsOpen));
    }
  }

  function refreshContext() {
    const ctx = getScreenContext();
    if (dom.contextLabel && ctx?.label) {
      dom.contextLabel.textContent = `Bağlam: ${ctx.label}`;
    }
    if (dom.quickChips) {
      dom.quickChips.innerHTML = "";
      const suggestions = getQuickChipsForContext(ctx);
      for (const promptText of suggestions) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "ai-quick-chip";
        chip.textContent = promptText;
        chip.disabled = isLoading;
        chip.addEventListener("click", () => {
          sendMessage(promptText);
        });
        dom.quickChips.appendChild(chip);
      }
    }
    if (history.length === 0) {
      renderMessages();
    }
  }

  function renderMessages() {
    if (!dom.messages) {
      return;
    }
    dom.messages.innerHTML = "";

    if (history.length === 0) {
      const ctx = getScreenContext();
      const empty = document.createElement("div");
      empty.className = "ai-welcome";

      const title = document.createElement("p");
      title.className = "ai-welcome-title";
      title.textContent = "Şu anki ekranını doğrudan görüyorum.";

      const desc = document.createElement("p");
      desc.className = "ai-welcome-desc";
      desc.textContent = config.apiKey
        ? `Aktif bağlam: ${ctx.label}. Aşağıdaki hazır sorulardan birine dokunabilir veya kendi sorunu yazabilirsin.`
        : "Sohbet için ücretsiz Gemini API anahtarını yukarıdan kaydet; istersen anahtar olmadan da kopyala düğmesiyle ekran bağlamını dışarı aktarabilirsin.";

      empty.appendChild(title);
      empty.appendChild(desc);
      dom.messages.appendChild(empty);
      return;
    }

    for (const msg of history) {
      const bubble = document.createElement("div");
      bubble.className =
        msg.role === "user"
          ? "ai-msg ai-msg-user"
          : msg.isError
            ? "ai-msg ai-msg-assistant is-error"
            : "ai-msg ai-msg-assistant";

      if (msg.role === "user") {
        bubble.textContent = msg.text;
      } else {
        renderFormattedText(bubble, msg.text);
      }
      dom.messages.appendChild(bubble);
    }

    if (isLoading) {
      const loadingBubble = document.createElement("div");
      loadingBubble.className = "ai-msg ai-msg-assistant is-loading";
      loadingBubble.textContent = "Düşünüyor...";
      dom.messages.appendChild(loadingBubble);
    }

    dom.messages.scrollTop = dom.messages.scrollHeight;
  }

  function autoResizeInput() {
    if (!dom.input) {
      return;
    }
    dom.input.style.height = "auto";
    const nextHeight = Math.min(dom.input.scrollHeight, 110);
    dom.input.style.height = `${nextHeight}px`;
  }

  function syncComposerState() {
    if (dom.btnSend) {
      dom.btnSend.disabled = isLoading;
    }
    if (dom.quickChips) {
      const chips = dom.quickChips.querySelectorAll(".ai-quick-chip");
      chips.forEach((chip) => {
        chip.disabled = isLoading;
      });
    }
  }

  async function sendMessage(rawText) {
    const text = String(rawText ?? dom.input.value).trim();
    if (!text || isLoading) {
      return;
    }

    if (text.length > MAX_PROMPT_LENGTH) {
      setStatus(`Soru en fazla ${MAX_PROMPT_LENGTH} karakter olabilir.`, "error");
      return;
    }

    if (!isValidApiKeyFormat(config.apiKey)) {
      settingsOpen = true;
      syncSettingsUI();
      setStatus("Soru göndermek için önce geçerli bir Gemini API anahtarı kaydedin.", "error");
      dom.apiKeyInput?.focus();
      return;
    }

    if (rawText === undefined) {
      dom.input.value = "";
      autoResizeInput();
    }

    const screenContext = getScreenContext();
    history.push({ role: "user", text });
    isLoading = true;
    syncComposerState();
    renderMessages();

    try {
      const reply = await requestGeminiReply({
        apiKey: config.apiKey,
        history,
        screenContext
      });
      history.push({ role: "assistant", text: reply });
    } catch (err) {
      history.push({
        role: "assistant",
        text: err?.message || "Yanıt alınamadı.",
        isError: true
      });
    } finally {
      isLoading = false;
      syncComposerState();
      renderMessages();
      if (isDrawerOpen) {
        dom.input?.focus();
      }
    }
  }

  function open() {
    if (isDrawerOpen) {
      return;
    }
    isDrawerOpen = true;
    settingsOpen = !config.apiKey;
    syncSettingsUI();
    refreshContext();
    dom.drawer.hidden = false;
    if (dom.backdrop) {
      dom.backdrop.hidden = false;
    }
    dom.fab.setAttribute("aria-expanded", "true");
    dom.fab.classList.add("is-open");

    window.setTimeout(() => {
      if (!isDrawerOpen) {
        return;
      }
      if (!config.apiKey && settingsOpen) {
        dom.apiKeyInput?.focus();
      } else {
        dom.input?.focus();
      }
    }, 20);
  }

  function close({ restoreFocus = true } = {}) {
    if (!isDrawerOpen) {
      return;
    }
    isDrawerOpen = false;
    dom.drawer.hidden = true;
    if (dom.backdrop) {
      dom.backdrop.hidden = true;
    }
    dom.fab.setAttribute("aria-expanded", "false");
    dom.fab.classList.remove("is-open");
    if (restoreFocus) {
      dom.fab.focus();
    }
  }

  dom.fab.addEventListener("click", () => {
    if (isDrawerOpen) {
      close();
    } else {
      open();
    }
  });

  dom.btnClose?.addEventListener("click", () => close());
  dom.backdrop?.addEventListener("click", () => close());

  dom.btnSettings?.addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    syncSettingsUI();
    if (settingsOpen && !config.apiKey) {
      dom.apiKeyInput?.focus();
    }
  });

  dom.btnSaveKey?.addEventListener("click", () => {
    const enteredKey = dom.apiKeyInput?.value.trim() || "";
    const selectedModel = dom.modelSelect?.value || DEFAULT_MODEL;
    const sessionOnly = Boolean(dom.sessionOnlyCheck?.checked);

    if (!enteredKey && !config.apiKey) {
      setStatus("Lütfen geçerli bir Gemini API anahtarı yapıştırın.", "error");
      dom.apiKeyInput?.focus();
      return;
    }

    if (enteredKey && !isValidApiKeyFormat(enteredKey)) {
      setStatus(
        "Anahtar biçimi geçersiz: boşluksuz, yalnızca ASCII karakterlerden oluşan en az 20 karakterli anahtar girin.",
        "error"
      );
      dom.apiKeyInput?.focus();
      return;
    }

    const nextKey = enteredKey || config.apiKey;
    config = saveAiConfig({ apiKey: nextKey, model: selectedModel, sessionOnly });
    const nextIdx = GEMINI_MODELS.indexOf(config.model);
    if (nextIdx >= 0) {
      preferredModelIndex = nextIdx;
    }
    settingsOpen = false;
    syncSettingsUI();
    renderMessages();
    setStatus(
      sessionOnly
        ? "API anahtarı yalnızca bu sekme oturumuna kaydedildi."
        : "API anahtarı ve model bu cihaza kaydedildi.",
      "ok"
    );
    announce?.("Gemini API anahtarı kaydedildi.");
    dom.input?.focus();
  });

  dom.sessionOnlyCheck?.addEventListener("change", () => {
    const sessionOnly = Boolean(dom.sessionOnlyCheck.checked);
    if (config.apiKey) {
      config = saveAiConfig({
        apiKey: config.apiKey,
        model: config.model,
        sessionOnly
      });
      setStatus(
        sessionOnly
          ? "Anahtar yalnızca bu oturumda tutulacak şekilde taşındı."
          : "Anahtar bu cihazda kalıcı saklanacak şekilde güncellendi.",
        "ok"
      );
    } else {
      config.sessionOnly = sessionOnly;
    }
  });

  dom.modelSelect?.addEventListener("change", () => {
    const nextModel = GEMINI_MODELS.includes(dom.modelSelect.value)
      ? dom.modelSelect.value
      : DEFAULT_MODEL;
    preferredModelIndex = GEMINI_MODELS.indexOf(nextModel);
    if (config.apiKey) {
      config = saveAiConfig({
        apiKey: config.apiKey,
        model: nextModel,
        sessionOnly: config.sessionOnly
      });
      setStatus(`Model ${nextModel} olarak güncellendi.`, "ok");
    } else {
      config.model = nextModel;
    }
  });

  dom.btnRemoveKey?.addEventListener("click", () => {
    config = removeAiApiKey(config.model, config.sessionOnly);
    syncSettingsUI();
    renderMessages();
    setStatus("API anahtarı bu cihazdan silindi.", "ok");
    announce?.("Gemini API anahtarı silindi.");
  });

  dom.btnClear?.addEventListener("click", () => {
    history = [];
    renderMessages();
    announce?.("Asistan sohbeti temizlendi.");
  });

  dom.btnCopyContext?.addEventListener("click", async () => {
    const ctx = getScreenContext();
    const payload = [
      "DeutschKarte ekranımdaki şu öğeyi Duden'e göre Türkçe açıklar mısın?",
      "",
      ctx.summary
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      setStatus("Ekran bağlamı panoya kopyalandı.", "ok");
      announce?.("Ekran bağlamı panoya kopyalandı.");
    } catch {
      settingsOpen = true;
      syncSettingsUI();
      setStatus("Pano izni verilemedi; HTTPS veya tarayıcı izni gerekir.", "error");
    }
  });

  dom.btnSend?.addEventListener("click", () => sendMessage());

  dom.input.addEventListener("input", autoResizeInput);
  dom.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isDrawerOpen) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  syncSettingsUI();
  refreshContext();

  return {
    open,
    close,
    isOpen: () => isDrawerOpen,
    refreshContext
  };
}
