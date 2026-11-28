import { LESSONS, ALL_WORDS } from "../data/index.js";
import { EXAMPLE_CHUNKS } from "../data/example-chunks.js";

const VALID_ARTICLES = new Set(["der", "die", "das"]);

const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const stripSentencePunct = (text) =>
  String(text || "")
    .trim()
    .replace(/^[.,!?;:()[\]"'„“‚‘«»]+|[.,!?;:()[\]"'„“‚‘«»]+$/g, "");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Mirrors `buildClozeForWord` in `app.js` so Cloze validation sees the exact
 * masked sentence and Turkish cue shown to learners.
 */
function buildClozeForWord(word) {
  const fullSentence = word?.example?.de;
  if (!fullSentence) {
    return null;
  }

  const candidateMap = new Map();
  const registerGroup = (rawForms) => {
    const group = [...new Set(toArray(rawForms).map(stripSentencePunct).filter(Boolean))];
    for (const cand of group) {
      const key = cand.toLowerCase();
      const existing = candidateMap.get(key);
      if (existing) {
        for (const form of group) {
          if (!existing.group.some((item) => item.toLowerCase() === form.toLowerCase())) {
            existing.group.push(form);
          }
        }
      } else {
        candidateMap.set(key, { cand, group: [...group] });
      }
    }
  };

  if (word.category === "noun") {
    registerGroup(word.singular);
    registerGroup(word.plural);
  } else {
    registerGroup([word.de, ...toArray(word.alt)]);
  }

  const sortedEntries = [...candidateMap.values()].sort(
    (a, b) => b.cand.length - a.cand.length
  );

  for (const entry of sortedEntries) {
    const rx = new RegExp(
      `(?<![\\p{L}\\p{N}_])${escapeRegex(entry.cand)}(?![\\p{L}\\p{N}_])`,
      "iu"
    );
    const match = fullSentence.match(rx);
    if (match && typeof match.index === "number") {
      const target = match[0];
      const before = fullSentence.slice(0, match.index);
      const after = fullSentence.slice(match.index + target.length);
      return {
        before,
        after,
        remainingDe: `${before} ${after}`.trim(),
        target,
        trCue: word.example.tr || word.tr || ""
      };
    }
  }

  return null;
}

const GENDERED_DE_CUES = [
  /\b(Mann|Frau|Herr|Vater|Mutter|Papa|Mama|Bruder|Schwester|Tante|Onkel)\b/u,
  /\b(Lukas|Nico|Deniz|Anna|Emma|Maria|Julia|Laura|Paul|Max|Tim|Tom|Leon|Lena|Sofie|Sophie|Weber|Becker)\b/u,
  /\b(Taxifahrer|Taxifahrerin|Student|Studentin|Pilot|Pilotin|Polizist|Polizistin|Tourist|Touristin|Deutschlehrer|Deutschlehrerin|Freund|Freundin|Lehrer|Lehrerin|Arzt|Ärztin)\b/u,
  /\b[A-ZÄÖÜ][a-zäöüß]+in\b/u
];

const PLURAL_DE_VERBS = /\b(sind|wohnen|kommen|haben|arbeiten|sprechen|lernen|machen|gehen|heißen|helfen|finden|warten)\b/iu;

const FORMAL_CUES = [
  /\b(Guten Tag|Guten Abend|Guten Morgen|Herr|Frau|Entschuldigung|bitte|Sie|Ihr|Ihre|Ihren|Ihnen)\b/u,
  /\(resmi\)/i
];

function validateClozeUnambiguity(word, cloze) {
  const issues = [];
  const baseDe = stripSentencePunct(word.de || "");
  const remainingDe = cloze.remainingDe;
  const trCue = cloze.trCue;

  // 1. Third-person singular pronouns (er / sie / es)
  if (word.category !== "noun" && /^(er|sie|es)$/i.test(baseDe)) {
    const lowerTarget = baseDe.toLowerCase();
    if (lowerTarget === "er" || lowerTarget === "sie") {
      const hasGermanGenderCue = GENDERED_DE_CUES.some((rx) => rx.test(remainingDe));
      const hasPluralVerbCue = lowerTarget === "sie" && PLURAL_DE_VERBS.test(remainingDe);
      const hasTurkishCue =
        /\((erkek|kadın)\)|\b(erkek|kadın)\b/iu.test(trCue) ||
        /\b(Anna|Emma|Lukas|Nico|Deniz)\b/u.test(trCue);

      if (!hasGermanGenderCue && !hasPluralVerbCue && !hasTurkishCue) {
        issues.push(
          `Cloze belirsizliği (${baseDe}): boşluk dışındaki cümlede ("${remainingDe}") veya Türkçe ipucunda ("${trCue}") cinsiyet/özne ayrımı yok.`
        );
      }
    } else if (lowerTarget === "es") {
      const hasNeuterReferent = /\bdas\s+[A-ZÄÖÜ]/u.test(remainingDe);
      const hasImpersonalCue = /\b(geht|regnet|schneit|gibt|ist)\b/iu.test(remainingDe);
      if (!hasNeuterReferent && !hasImpersonalCue) {
        issues.push(
          `Cloze belirsizliği (es): nötr gönderim ("das ...") veya kişisiz fiil ipucu bulunamadı.`
        );
      }
    }
  }

  // 2. Formal "Sie" items (hint mentions "Resmi" and target uses capitalized "Sie")
  if (
    word.category !== "noun" &&
    /Resmi/i.test(word.hint || "") &&
    /\bSie\b/.test(word.de || "")
  ) {
    const hasFormalCue = FORMAL_CUES.some(
      (rx) => rx.test(remainingDe) || rx.test(trCue)
    );
    if (!hasFormalCue) {
      issues.push(
        `Cloze belirsizliği (resmi Sie): boşluk dışındaki cümle ("${remainingDe}") veya Türkçe ipucu ("${trCue}") resmi hitap ipucu içermiyor.`
      );
    }
  }

  // 3. Register / context-sensitive items
  if (word.category === "noun" && /\(samimi\)/i.test(word.tr || "")) {
    const hasSamimiCue =
      /\bsamimi\b|\banneciğim\b|\bbabacığım\b/iu.test(trCue) ||
      /\bsamimi\b/iu.test(remainingDe);
    if (!hasSamimiCue) {
      issues.push(
        `Cloze belirsizliği (samimi kayıt): "${word.singular}" için örnek cümle veya çevirisinde ("${trCue}") samimi ipucu yok.`
      );
    }
  }

  if (/\(telefonda/i.test(word.tr || "")) {
    const hasPhoneCue = /telefon/iu.test(word.example?.de || "") || /telefon/iu.test(trCue);
    if (!hasPhoneCue) {
      issues.push(
        `Cloze belirsizliği (telefonda): "${word.de}" için örnek cümlede veya çevirisinde telefon bağlamı yok.`
      );
    }
  }

  const formMatch = (word.tr || "").match(/\((kısa biçim|uzun biçim)\)/i);
  if (formMatch) {
    const requiredCue = formMatch[1].toLowerCase();
    if (!trCue.toLowerCase().includes(requiredCue)) {
      issues.push(
        `Cloze belirsizliği (${requiredCue}): "${word.singular || word.de}" için örnek cümle çevirisinde ("${trCue}") "${requiredCue}" ipucu yok.`
      );
    }
  }

  return issues;
}

function validateLessons() {
  const errors = [];
  const seenIds = new Set();

  for (const lesson of LESSONS) {
    for (const item of lesson.items || []) {
      if (!item.id) {
        errors.push(`[${lesson.id}] Eksik item.id bulundu.`);
        continue;
      }

      if (seenIds.has(item.id)) {
        errors.push(`[${item.id}] Yinelenen öğe kimliği (duplicate id).`);
      }
      seenIds.add(item.id);

      if (item.category === "noun") {
        if (item.onlyPlural) {
          if (item.article !== "nur Pl.") {
            errors.push(
              `[${item.id}] onlyPlural isimler için artikel "nur Pl." olmalı (mevcut: "${item.article}").`
            );
          }
        } else if (!VALID_ARTICLES.has(item.article)) {
          errors.push(
            `[${item.id}] Geçersiz artikel "${item.article}" — Duden'a göre "der", "die" veya "das" olmalı.`
          );
        }
      }

      if (item.hint) {
        const targetText =
          item.category === "noun"
            ? item.onlyPlural
              ? toArray(item.plural)[0]
              : toArray(item.singular)[0]
            : item.de;
        const cleanTarget = stripSentencePunct(targetText || "");
        if (cleanTarget.length >= 4) {
          const leakRx = new RegExp(
            `(?<![\\p{L}\\p{N}_])${escapeRegex(cleanTarget)}(?![\\p{L}\\p{N}_])`,
            "iu"
          );
          if (leakRx.test(item.hint)) {
            errors.push(
              `[${item.id}] Hint sızıntısı: hint ("${item.hint}") hedef Almanca kelimeyi ("${cleanTarget}") içeriyor.`
            );
          }
        }
      }

      const cloze = buildClozeForWord(item);
      if (cloze) {
        for (const issue of validateClozeUnambiguity(item, cloze)) {
          errors.push(`[${item.id}] ${issue}`);
        }
      }

      if (item.example?.de) {
        const chunks = EXAMPLE_CHUNKS[item.id];
        if (!Array.isArray(chunks) || chunks.length === 0) {
          errors.push(
            `[${item.id}] example.de için EXAMPLE_CHUNKS kaydı eksik veya boş.`
          );
        } else {
          for (const pair of chunks) {
            if (
              !Array.isArray(pair) ||
              pair.length !== 2 ||
              typeof pair[0] !== "string" ||
              typeof pair[1] !== "string" ||
              !pair[0].trim() ||
              !pair[1].trim()
            ) {
              errors.push(
                `[${item.id}] Geçersiz EXAMPLE_CHUNKS çifti: [de, tr] metin çifti olmalı.`
              );
              break;
            }
          }
        }
      }
    }
  }

  for (const chunkId of Object.keys(EXAMPLE_CHUNKS)) {
    if (!seenIds.has(chunkId)) {
      errors.push(
        `[${chunkId}] EXAMPLE_CHUNKS içinde karşılığı olmayan (yetim) öğe kimliği.`
      );
    }
  }

  if (errors.length > 0) {
    console.error(`HATA: ${errors.length} ders doğrulama sorunu bulundu:`);
    for (const err of errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: ${LESSONS.length} ders, ${ALL_WORDS.length} kelime ve ${Object.keys(EXAMPLE_CHUNKS).length} örnek cümle kalıbı doğrulandı — 0 hata.`
  );
}

validateLessons();
