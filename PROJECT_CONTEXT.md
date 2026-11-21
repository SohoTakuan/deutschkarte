# DeutschKarte — Proje Bağlamı ve Geliştirme Protokolü

**DeutschKarte**, Türkçe konuşan kullanıcıların A1'den C1'e kadar Almanca kelimeleri, artikelleri (`der`, `die`, `das`, `nur Pl.`, `nur Sg.`) ve çoğul biçimlerini aralıklı tekrar (Leitner SRS) ile kalıcı biçimde öğrenmesi için geliştirilmiş, modüler ES Module veri katmanlı ve çevrimdışı çalışabilen bir Progressive Web App (PWA) uygulamasıdır. Tüm kullanıcı arayüzü, düğmeler, ipuçları ve geri bildirimler doğal Türkçe ile yazılmıştır.

- **GitHub Deposu:** `https://github.com/SohoTakuan/deutschkarte`
- **Canlı Adres (GitHub Pages):** `https://sohotakuan.github.io/deutschkarte/`

---

## Dosya Yapısı

- `index.html`: Uygulama iskeleti (`Çalış`, `Kelime Sözlüğü`, tema değiştirici, `İlerleme` penceresi), ilk açılış tema önleme betiği, başlatma kurtarma denetleyicisi ve PWA meta etiketleri.
- `styles.css`: Leitner kartı estetiğine dayalı aydınlık ve Prusya gecesi karanlık mod tasarım token'ları (`--desk`, `--card`, `--ink`, `--accent-der/die/das/pl/sg`), tipografi (`Bricolage Grotesque` + `Source Sans 3`), duyarlı düzen ve erişilebilirlik stilleri.
- `app.js`: Çalışma modları (`Karma Mod`, `Sadece Şıklı`, `Sadece Yazmalı`, `Artikel Pratiği`, `Zorlandıklarım`), çift yönlü pratik (`TR / DE` ve `DE / TR`), 5 kutulu Leitner aralıklı tekrar motoru (`cards`), günlük hedef/seri (`daily`), `de-DE` Web Speech API telaffuz desteği, ders filtresi, aydınlık/karanlık tema yönetimi (`deutschkarte_theme`), bağımsız doğrulama, umlaut çubuğu, klavye kısayolları (`1`–`4`, `Enter`, `Alt+S`), sözlük araması ve `localStorage` JSON yedekleme + GitHub Gist senkronizasyon mantığı.
- `sync.js`: Çevrimdışı öncelikli GitHub Gist otomatik bulut senkronizasyonu (`deutschkarte_gist_sync_v1`, akıllı birleştirme `mergeStates`, silme izleri `mistakeClearedAt` ve sıfırlama baskınlığı `resetAt`).
- `manifest.json`: Ana ekrana eklenebilir PWA yapılandırması.
- `sw.js`: Çevrimdışı önbellek yönetimi (`CACHE_VERSION` şu an `"deutschkarte-v5"` ve `PRECACHE_URLS`; yerel dosyalar için ağ-öncelikli, çevrimdışı durumda önbellek yedeği).
- `icons/`: `icon.svg`, `icon-192.png`, `icon-512.png`.
- `baslat.bat`: Windows için tek tıkla Python yerel HTTP sunucusunu (`http://localhost:8000`) başlatıp tarayıcıda açan betik (ES Module CORS sorunlarını önler ve Windows Store Python takma adını atlar).
- `data/lesson_01.js`: Ders 1 (`level: "A1"`) veri modülü (Duden doğrulamalı 71 kayıt ve her kayıt için A1 örnek cümlesi: 49 isim, 18 kalıp, 4 fiil).
- `data/index.js`: Tüm ders modüllerini toplayan, `id` bazında tekilleştiren (`ALL_WORDS`), `level` / `lesson` / `lessonId` alanlarını normalize eden ve seviye özeti (`getLevelSummary`) üreten veri giriş noktası.
- `PROJECT_CONTEXT.md`: Gelecek oturumlar için kalıcı proje belleği.

---

## Veri Şeması ve ID Standardı

### ID Biçimi ve Ders Modülü Yapısı
- Her ders modülü bir CEFR `level` (`"A1" | "A2" | "B1" | "B2" | "C1"`) içerir:
  ```js
  export const lesson02 = {
    id: "lesson_02",
    level: "A1",
    title: "Ders 2",
    subtitle: "...",
    items: [...]
  };
  ```
- Kayıt ID biçimi: `l{dersNumarasi}_{ikiHaneliSira}` (`l1_01`–`l1_71`, `l2_01`, ..., `l10_01`).

### İsim (`category: "noun"`) Şeması
```js
{
  id: "l1_06",
  category: "noun",
  lesson: "Ders 1",
  tr: "Kahve",
  article: "der",          // "der" | "die" | "das" | "nur Pl." (onlySingular isimlerde ASLA "nur Sg." yazmayın, gerçek Duden artikelini yazın)
  singular: "Kaffee",      // string | string[] | null (onlyPlural ise null)
  plural: "Kaffees",       // string | string[] | null (onlySingular ise null)
  onlySingular: false,     // Sadece tekil isimler için true (Çoğul alanını kilitler; hem der/die/das hem "nur Sg." kabul edilir)
  onlyPlural: false,       // Sadece çoğul isimler için true (Tekil alanını kilitler; article "nur Pl." olur)
  hint: "",                // Opsiyonel: Cevabı ele vermeden soru kartında gösterilir
  note: "Sayılarla çoğul eki almaz: zwei Kaffee", // Opsiyonel: Cevaptan sonra ve sözlükte gösterilir
  example: {               // Opsiyonel ama önerilen: Cevap sonrası ve sözlükte gösterilen örnek cümle
    de: "Ich trinke am Morgen gern einen Kaffee.",
    tr: "Sabahları bir kahve içmeyi severim."
  }
}
```

> **Kritik Kural:** `onlySingular: true` olan isimlerde (`der Sport`, `die Musik` gibi) `article` alanı mutlaka `"der"`, `"die"` veya `"das"` olmalıdır — `"nur Sg."` yazılmamalıdır. Uygulama hem gerçek artikeli hem de `"nur Sg."` seçimini otomatik olarak doğru kabul eder.

### Kalıp ve Fiil (`category: "phrase" | "verb"`) Şeması
```js
{
  id: "l1_51",
  category: "phrase",      // "phrase" | "verb"
  lesson: "Ders 1",
  tr: "Nasılsın?",
  de: "Wie geht es dir?",
  alt: ["Wie geht's?"],    // Opsiyonel: Diğer geçerli Almanca karşılıklar
  hint: "Samimi hitap",    // Opsiyonel: Soru kartında gösterilen bağlam ipucu
  note: "Kısa biçimi: Wie geht's?", // Opsiyonel: Cevap sonrası ve sözlük notu
  example: {
    de: "Hallo Anna, wie geht es dir heute?",
    tr: "Merhaba Anna, bugün nasılsın?"
  }
}
```

> **Önemli Not:** Almanca kelime veya çekim ipucu içeren açıklamaları **her zaman `note` alanına** koyun; `hint` alanı yalnızca cevabı belli etmeyen bağlam bilgisi (`Samimi hitap`, `Resmi hitap` vb.) içermelidir.

---

## Gelecek Oturumlar İçin Yeni Ders Ekleme Protokolü

Kullanıcı yeni el yazısı notları veya PDF ders notları paylaştığında aşağıdaki 5 adımı eksiksiz uygulayın:

1. **Modüler Ders Dosyası Oluştur ve Kaydet**
   - `data/lesson_XX.js` (ör. `data/lesson_02.js`) dosyasını oluşturun ve uygun `level` (`"A1"`, `"A2"`, `"B1"`, `"B2"` veya `"C1"`) bilgisiyle dışa aktarın.
   - Yeni dersi `data/index.js` içine `import` edip `LESSONS` dizisine ekleyin (`data/index.js` `level`, `lesson` ve `lessonId` değerlerini otomatik normalize eder).
   - `app.js`, `styles.css` veya `index.html` dosyalarında değişiklik **yapmayın**.

2. **Duden Doğrulaması, Doğal Türkçe ve Örnek Cümleler**
   - El yazısı veya OCR kaynaklı yazım hatalarını, eksik umlautları (`ä`, `ö`, `ü`, `ß`), büyük/küçük harf hatalarını, yanlış artikelleri ve çoğul eklerini **Duden** Almanca standartlarına göre kesinleştirin.
   - `onlySingular` (`nur Singular`) ve `onlyPlural` (`nur Plural`) durumlarını mutlaka işaretleyin.
   - Türkçe karşılıkları çeviri kokan mekanik ifadeler yerine doğal Türkçe ile yazın ve her kayıt için seviyesine uygun `example: { de, tr }` cümlesi ekleyin.

3. **Mevcut Verilerle Tekilleştirme (Deduplication)**
   - Yeni kayıtları eklemeden önce `data/index.js` içindeki mevcut `ALL_WORDS` kayıtlarıyla karşılaştırın; daha önceki derslerde eklenmiş aynı kelime veya kalıpları yeni derste tekrarlamayın.

4. **Service Worker Önbellek Sürümünü Artır**
   - `sw.js` içindeki `PRECACHE_URLS` listesine yeni `./data/lesson_XX.js` yolunu ekleyin.
   - `sw.js` dosyasındaki `CACHE_VERSION` sabitini bir üst sürüme (`"deutschkarte-v6"`, `"deutschkarte-v7"` vb.) artırarak kullanıcıların tarayıcılarında eski önbellek takılması olmadan yeni kelimelerin hemen yüklenmesini sağlayın.

5. **GitHub Pages'e Yayınla**
   - Değişiklikleri `git add`, `git commit` ve `git push` ile `main` dalına gönderin; böylece canlı `https://sohotakuan.github.io/deutschkarte/` adresi ve telefona eklenen PWA otomatik güncellensin.
