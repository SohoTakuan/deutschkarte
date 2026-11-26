const DESKTOP_MEDIA_QUERY = "(min-width: 1180px) and (hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const STORAGE_KEY = "deutschkarte_companion_v1";

const EXPRESSIONS = {
  idle: "assets/companion/idle.png",
  happy: "assets/companion/happy.png",
  tease: "assets/companion/tease.png",
  blush: "assets/companion/blush.png"
};

const CORRECT_LINES_LOW = [
  "Sehr gut! Doğru bildin, devam et.",
  "Bravo! Bu kelime artık kafana yerleşti.",
  "Super! Artikeliyle birlikte tam isabet.",
  "Harika gidiyorsun, ritmi hiç bozma!"
];

const CORRECT_LINES_MID = [
  "Wunderbar! Arka arkaya çok temiz gidiyorsun.",
  "Klasse! Böyle devam edersen B1 çantada keklik.",
  "Genau so! Almanca sende iyice oturmaya başladı."
];

const CORRECT_LINES_HIGH = [
  "Unglaublich! Makine gibisin, hiç durma!",
  "Wahnsinn! Bu seriyle Goethe sınavını parçalarsın.",
  "Perfekt! Bugün resmen alev aldın."
];

const WRONG_LINES = [
  "Olsun, hata yapınca beyne daha iyi kazınır.",
  "Übung macht den Meister! Bir sonraki turda senin.",
  "Küçük bir takılma — artikeline bir kez daha göz at.",
  "Sorun değil, yanlışlar bunun için var. Devam!"
];

const POKE_LINES = [
  "Bugün kaç kart hedefliyoruz? Los geht's!",
  "Artikelleri sesli söylemeyi unutma: der, die, das!",
  "Kafan dağıldıysa bir yudum su al, sonra sıradaki kart.",
  "Mach weiter! Her gün 20 kart seni Almanya'ya yaklaştırır."
];

const BLUSH_LINES = [
  "Hey, bana tıklayıp durma da şu kartı çöz!",
  "Tamam tamam, odaklanalım... Almanca bekliyor!",
  "Böyle bakarsan ben nasıl ders anlatayım?"
];

const IDLE_LINES = [
  "Bir kart daha çözelim mi? Los geht's!",
  "Sıradaki kelime seni bekliyor, ritmi kaybetmeyelim.",
  "Kısa bir mola mı? Hazırsan bir kart daha aç."
];

function pickRandom(list, lastValue) {
  if (!list.length) {
    return "";
  }
  if (list.length === 1) {
    return list[0];
  }
  let candidate = list[Math.floor(Math.random() * list.length)];
  if (candidate === lastValue) {
    candidate = list[(list.indexOf(candidate) + 1) % list.length];
  }
  return candidate;
}

function loadCompanionState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { collapsed: false };
    }
    const parsed = JSON.parse(raw);
    return { collapsed: Boolean(parsed?.collapsed) };
  } catch {
    return { collapsed: false };
  }
}

function saveCompanionState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      collapsed: Boolean(state.collapsed)
    }));
  } catch {
    // Ignore storage quota/privacy-mode errors
  }
}

export function initCompanion() {
  const dock = document.getElementById("companion-dock");
  const stage = document.getElementById("companion-stage");
  const img = document.getElementById("companion-img");
  const textEl = document.getElementById("companion-text");
  const moodEl = document.getElementById("companion-mood-tag");
  const streakEl = document.getElementById("companion-streak");
  const fxEl = document.getElementById("companion-fx");
  const toggleBtn = document.getElementById("companion-toggle");
  const miniBtn = document.getElementById("companion-mini-btn");
  const studyView = document.getElementById("study-view");

  if (!dock || !stage || !img || !textEl || !moodEl || !toggleBtn || !miniBtn) {
    return;
  }

  const desktopMq = window.matchMedia(DESKTOP_MEDIA_QUERY);
  const reducedMotionMq = window.matchMedia(REDUCED_MOTION_QUERY);

  let initializedDesktop = false;
  let preloaded = false;
  let state = loadCompanionState();
  let streak = 0;
  let lastLine = "";
  let clickTimestamps = [];
  let resetTimer = 0;
  let idleTimer = 0;

  function preloadExpressions() {
    if (preloaded) {
      return;
    }
    preloaded = true;
    for (const src of Object.values(EXPRESSIONS)) {
      const preloadImg = new Image();
      preloadImg.src = src;
    }
  }

  function applyCollapsed(collapsed, persist = false) {
    state.collapsed = collapsed;
    dock.hidden = collapsed;
    miniBtn.hidden = !collapsed;
    if (persist) {
      saveCompanionState(state);
    }
    if (collapsed) {
      window.clearTimeout(idleTimer);
    } else {
      scheduleIdleNudge();
    }
  }

  function setMoodTag(label, tone = "neutral") {
    moodEl.textContent = label;
    moodEl.dataset.tone = tone;
  }

  function setSpeech(line, moodLabel, tone = "neutral") {
    lastLine = line;
    textEl.textContent = line;
    setMoodTag(moodLabel, tone);
  }

  function updateStreakBadge() {
    if (!streakEl) {
      return;
    }
    if (streak >= 2) {
      streakEl.textContent = `${streak} seri`;
      streakEl.hidden = false;
    } else {
      streakEl.hidden = true;
    }
  }

  function triggerAnimation(className) {
    if (reducedMotionMq.matches) {
      return;
    }
    stage.classList.remove("is-happy", "is-tease", "is-blush", "is-poke");
    void stage.offsetWidth;
    stage.classList.add(className);
  }

  function spawnFx(symbols) {
    if (!fxEl || reducedMotionMq.matches) {
      return;
    }
    for (let i = 0; i < symbols.length; i += 1) {
      const span = document.createElement("span");
      span.className = "companion-fx-particle";
      span.textContent = symbols[i];
      span.style.setProperty("--fx-x", `${22 + i * 26 + Math.round(Math.random() * 14)}%`);
      span.style.setProperty("--fx-delay", `${i * 80}ms`);
      fxEl.appendChild(span);
      span.addEventListener("animationend", () => span.remove(), { once: true });
    }
  }

  function setExpression(key, animClass = "") {
    const nextSrc = EXPRESSIONS[key] || EXPRESSIONS.idle;
    if (img.getAttribute("src") !== nextSrc) {
      img.setAttribute("src", nextSrc);
    }
    if (animClass) {
      triggerAnimation(animClass);
    }
    window.clearTimeout(resetTimer);
    if (key !== "idle") {
      resetTimer = window.setTimeout(() => {
        img.setAttribute("src", EXPRESSIONS.idle);
        stage.classList.remove("is-happy", "is-tease", "is-blush", "is-poke");
        setMoodTag("Hazır", "neutral");
      }, 4500);
    }
  }

  function scheduleIdleNudge() {
    window.clearTimeout(idleTimer);
    if (!desktopMq.matches || state.collapsed) {
      return;
    }
    idleTimer = window.setTimeout(() => {
      if (!desktopMq.matches || state.collapsed) {
        return;
      }
      if (studyView && studyView.hidden) {
        scheduleIdleNudge();
        return;
      }
      const line = pickRandom(IDLE_LINES, lastLine);
      setSpeech(line, "İpucu", "neutral");
      setExpression("tease", "is-poke");
    }, 45000);
  }

  function handleAnswerEvent(event) {
    if (!desktopMq.matches) {
      return;
    }
    scheduleIdleNudge();
    const isCorrect = Boolean(event?.detail?.isCorrect);
    if (isCorrect) {
      streak += 1;
      updateStreakBadge();
      let pool = CORRECT_LINES_LOW;
      if (streak >= 10) {
        pool = CORRECT_LINES_HIGH;
      } else if (streak >= 3) {
        pool = CORRECT_LINES_MID;
      }
      const tag = streak >= 2 ? `Seri x${streak}` : "Doğru!";
      setSpeech(pickRandom(pool, lastLine), tag, "happy");
      setExpression("happy", "is-happy");
      spawnFx(streak >= 5 ? ["✦", "♥", "✦"] : ["✦", "✦"]);
      return;
    }

    streak = 0;
    updateStreakBadge();
    setSpeech(pickRandom(WRONG_LINES, lastLine), "Tekrar Dene", "tease");
    setExpression("tease", "is-tease");
  }

  function handleStageClick() {
    if (!desktopMq.matches) {
      return;
    }
    scheduleIdleNudge();
    const now = Date.now();
    clickTimestamps = clickTimestamps.filter((ts) => now - ts < 6000);
    clickTimestamps.push(now);

    if (clickTimestamps.length >= 3) {
      setSpeech(pickRandom(BLUSH_LINES, lastLine), "Utandı", "blush");
      setExpression("blush", "is-blush");
      spawnFx(["♥", "♥"]);
      return;
    }

    const expr = clickTimestamps.length % 2 === 1 ? "happy" : "tease";
    setSpeech(pickRandom(POKE_LINES, lastLine), "Lena", "neutral");
    setExpression(expr, "is-poke");
  }

  function handlePointerMove(event) {
    if (!desktopMq.matches || reducedMotionMq.matches) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    const tiltY = (nx * 7).toFixed(2);
    const tiltX = (-ny * 6).toFixed(2);
    stage.style.setProperty("--tilt-x", `${tiltX}deg`);
    stage.style.setProperty("--tilt-y", `${tiltY}deg`);
  }

  function resetTilt() {
    stage.style.setProperty("--tilt-x", "0deg");
    stage.style.setProperty("--tilt-y", "0deg");
  }

  function activateDesktop() {
    if (!desktopMq.matches) {
      window.clearTimeout(idleTimer);
      return;
    }
    preloadExpressions();
    applyCollapsed(state.collapsed, false);
    if (initializedDesktop) {
      return;
    }
    initializedDesktop = true;

    window.addEventListener("deutschkarte:answer", handleAnswerEvent);
    stage.addEventListener("click", handleStageClick);
    stage.addEventListener("pointermove", handlePointerMove);
    stage.addEventListener("pointerleave", resetTilt);
    toggleBtn.addEventListener("click", () => applyCollapsed(true, true));
    miniBtn.addEventListener("click", () => applyCollapsed(false, true));
  }

  activateDesktop();
  if (typeof desktopMq.addEventListener === "function") {
    desktopMq.addEventListener("change", activateDesktop);
  }
}
