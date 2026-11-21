(function () {
  function showBootRecovery(title, hint, allowCacheReset) {
    var titleEl = document.getElementById("prompt-tr");
    var hintEl = document.getElementById("prompt-hint");
    var promptWrap = titleEl ? titleEl.closest(".card-prompt") : null;
    if (titleEl) {
      titleEl.textContent = title;
    }
    if (hintEl) {
      hintEl.textContent = hint;
      hintEl.hidden = false;
    }
    if (allowCacheReset && promptWrap && !document.getElementById("boot-reset-btn")) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "boot-reset-btn";
      btn.className = "btn-secondary boot-reset-btn";
      btn.textContent = "Önbelleği temizle ve yenile";
      btn.addEventListener("click", async function () {
        try {
          if ("serviceWorker" in navigator) {
            var regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(function (r) { return r.unregister(); }));
          }
          if ("caches" in window) {
            var keys = await caches.keys();
            await Promise.all(keys.map(function (k) { return caches.delete(k); }));
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        window.location.reload();
      });
      promptWrap.appendChild(btn);
    }
  }

  if (window.location.protocol === "file:") {
    showBootRecovery(
      "Yerel sunucu gerekli",
      "ES modülleri doğrudan dosya yolunda çalışmaz. Klasördeki baslat.bat dosyasına çift tıklayarak http://localhost:8000 üzerinden açın.",
      false
    );
    return;
  }

  window.setTimeout(function () {
    if (!window.__deutschkarteReady) {
      showBootRecovery(
        "Uygulama başlatılamadı",
        "Sunucu bağlantısı veya tarayıcı önbelleği güncel değil. Sunucunun açık olduğundan emin olup önbelleği temizleyerek yenileyin.",
        true
      );
    }
  }, 3000);
})();
