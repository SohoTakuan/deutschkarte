export const PRONOUN_SLOTS = [
  { key: "ich", label: "ich", tr: "Ben", regularEnd: "-e" },
  { key: "du", label: "du", tr: "Sen", regularEnd: "-st" },
  { key: "er", label: "er / sie / es", tr: "O", regularEnd: "-t" },
  { key: "wir", label: "wir", tr: "Biz", regularEnd: "-en" },
  { key: "ihr", label: "ihr", tr: "Siz (samimi)", regularEnd: "-t" },
  { key: "sie", label: "sie / Sie", tr: "Onlar / Siz (resmi)", regularEnd: "-en" }
];

export const VERB_GROUPS = [
  { id: "all", label: "Tümü" },
  { id: "regular", label: "Düzenli" },
  { id: "td", label: "-t / -d (-e- kuralı)" },
  { id: "irregular", label: "Düzensiz" }
];

export const CONJUGATION_VERBS = [
  {
    id: "v_machen",
    infinitive: "machen",
    tr: "yapmak",
    lesson: "Ders 2",
    level: "A1",
    group: "regular",
    stem: "mach-",
    forms: {
      ich: "mache",
      du: "machst",
      er: "macht",
      wir: "machen",
      ihr: "macht",
      sie: "machen"
    },
    principalParts: "macht · machte · hat gemacht",
    ruleTip: "Düzenli fiil: köke (mach-) sırasıyla -e, -st, -t, -en, -t, -en ekleri gelir.",
    example: {
      de: "Ich mache einen Sprachkurs.",
      tr: "Dil kursuna gidiyorum."
    }
  },
  {
    id: "v_lernen",
    infinitive: "lernen",
    tr: "öğrenmek",
    lesson: "Ders 2",
    level: "A1",
    group: "regular",
    stem: "lern-",
    forms: {
      ich: "lerne",
      du: "lernst",
      er: "lernt",
      wir: "lernen",
      ihr: "lernt",
      sie: "lernen"
    },
    principalParts: "lernt · lernte · hat gelernt",
    ruleTip: "Düzenli fiil: kök lern- değişmeden standart ekleri alır.",
    example: {
      de: "Wir lernen zusammen Deutsch.",
      tr: "Birlikte Almanca öğreniyoruz."
    }
  },
  {
    id: "v_wohnen",
    infinitive: "wohnen",
    tr: "oturmak / yaşamak",
    lesson: "Ders 2",
    level: "A1",
    group: "regular",
    stem: "wohn-",
    forms: {
      ich: "wohne",
      du: "wohnst",
      er: "wohnt",
      wir: "wohnen",
      ihr: "wohnt",
      sie: "wohnen"
    },
    principalParts: "wohnt · wohnte · hat gewohnt",
    ruleTip: "Düzenli fiil: kök wohn- doğrudan standart çekim eklerini alır.",
    example: {
      de: "Ich wohne in Sevilla.",
      tr: "Sevilla'da oturuyorum."
    }
  },
  {
    id: "v_kommen",
    infinitive: "kommen",
    tr: "gelmek",
    lesson: "Ders 2",
    level: "A1",
    group: "regular",
    stem: "komm-",
    forms: {
      ich: "komme",
      du: "kommst",
      er: "kommt",
      wir: "kommen",
      ihr: "kommt",
      sie: "kommen"
    },
    principalParts: "kommt · kam · ist gekommen",
    ruleTip: "Dikkat: Şimdiki zamanda kökteki çift m korunur — er/sie/es kommt (komt değil).",
    example: {
      de: "Ich komme aus Spanien.",
      tr: "İspanya'dan geliyorum."
    }
  },
  {
    id: "v_arbeiten",
    infinitive: "arbeiten",
    tr: "çalışmak",
    lesson: "Ders 2",
    level: "A1",
    group: "td",
    stem: "arbeit-",
    forms: {
      ich: "arbeite",
      du: "arbeitest",
      er: "arbeitet",
      wir: "arbeiten",
      ihr: "arbeitet",
      sie: "arbeiten"
    },
    principalParts: "arbeitet · arbeitete · hat gearbeitet",
    ruleTip: "Kök -t ile bittiği için du (-est), er/sie/es (-et) ve ihr (-et) çekimlerinde araya -e- girer.",
    example: {
      de: "Du arbeitest heute sehr viel.",
      tr: "Bugün çok çalışıyorsun."
    }
  },
  {
    id: "v_antworten",
    infinitive: "antworten",
    tr: "cevap vermek",
    lesson: "Ders 2",
    level: "A1",
    group: "td",
    stem: "antwort-",
    forms: {
      ich: "antworte",
      du: "antwortest",
      er: "antwortet",
      wir: "antworten",
      ihr: "antwortet",
      sie: "antworten"
    },
    principalParts: "antwortet · antwortete · hat geantwortet",
    ruleTip: "Kök -t ile bittiği için du antwortest, er/sie/es antwortet ve ihr antwortet biçiminde -e- alır.",
    example: {
      de: "Er antwortet sofort auf die E-Mail.",
      tr: "E-postaya hemen cevap veriyor."
    }
  },
  {
    id: "v_finden",
    infinitive: "finden",
    tr: "bulmak",
    lesson: "Ders 2",
    level: "A1",
    group: "td",
    stem: "find-",
    forms: {
      ich: "finde",
      du: "findest",
      er: "findet",
      wir: "finden",
      ihr: "findet",
      sie: "finden"
    },
    principalParts: "findet · fand · hat gefunden",
    ruleTip: "Kök -d ile bittiği için du findest, er/sie/es findet ve ihr findet çekimlerinde araya -e- girer.",
    example: {
      de: "Findest du deinen Pass?",
      tr: "Pasaportunu bulabiliyor musun?"
    }
  },
  {
    id: "v_warten",
    infinitive: "warten",
    tr: "beklemek",
    lesson: "Ders 2",
    level: "A1",
    group: "td",
    stem: "wart-",
    forms: {
      ich: "warte",
      du: "wartest",
      er: "wartet",
      wir: "warten",
      ihr: "wartet",
      sie: "warten"
    },
    principalParts: "wartet · wartete · hat gewartet",
    ruleTip: "Kök -t ile bittiği için du wartest, er/sie/es wartet ve ihr wartet çekimlerinde araya -e- girer.",
    example: {
      de: "Ihr wartet vor dem Café.",
      tr: "Kafenin önünde bekliyorsunuz."
    }
  },
  {
    id: "v_heissen",
    infinitive: "heißen",
    tr: "adı ... olmak",
    lesson: "Ders 2",
    level: "A1",
    group: "irregular",
    stem: "heiß-",
    forms: {
      ich: "heiße",
      du: "heißt",
      er: "heißt",
      wir: "heißen",
      ihr: "heißt",
      sie: "heißen"
    },
    principalParts: "heißt · hieß · hat geheißen",
    ruleTip: "Kök -ß ile bittiği için du çekiminde ekstra -s düşer: du heißt (heißst değil).",
    example: {
      de: "Wie heißt du?",
      tr: "Adın ne?"
    }
  },
  {
    id: "v_sein",
    infinitive: "sein",
    tr: "olmak",
    lesson: "Ders 2",
    level: "A1",
    group: "irregular",
    stem: "—",
    forms: {
      ich: "bin",
      du: "bist",
      er: "ist",
      wir: "sind",
      ihr: "seid",
      sie: "sind"
    },
    principalParts: "ist · war · ist gewesen",
    ruleTip: "Tamamen düzensiz çekimlenir; kalıp olarak ezberlenir: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie/Sie sind.",
    example: {
      de: "Wer bist du?",
      tr: "Sen kimsin?"
    }
  },
  {
    id: "v_haben",
    infinitive: "haben",
    tr: "sahip olmak",
    lesson: "Ders 2",
    level: "A1",
    group: "irregular",
    stem: "hab-",
    forms: {
      ich: "habe",
      du: "hast",
      er: "hat",
      wir: "haben",
      ihr: "habt",
      sie: "haben"
    },
    principalParts: "hat · hatte · hat gehabt",
    ruleTip: "Dikkat: du hast ve er/sie/es hat biçiminde b düşer; ancak ihr habt çekiminde b korunur (hast değil!).",
    example: {
      de: "Ich habe keine Ahnung.",
      tr: "Hiçbir fikrim yok."
    }
  },
  {
    id: "v_sprechen",
    infinitive: "sprechen",
    tr: "konuşmak",
    lesson: "Ders 2",
    level: "A1",
    group: "irregular",
    stem: "sprech- / sprich-",
    forms: {
      ich: "spreche",
      du: "sprichst",
      er: "spricht",
      wir: "sprechen",
      ihr: "sprecht",
      sie: "sprechen"
    },
    principalParts: "spricht · sprach · hat gesprochen",
    ruleTip: "Ünlü değişimi (e -> i) yalnızca du (sprichst) ve er/sie/es (spricht) çekimlerinde olur; ihr sprecht sabit kalır.",
    example: {
      de: "Sie sprechen gut Deutsch.",
      tr: "Almancayı iyi konuşuyorsunuz."
    }
  },
  {
    id: "v_helfen",
    infinitive: "helfen",
    tr: "yardım etmek",
    lesson: "Ders 2",
    level: "A1",
    group: "irregular",
    stem: "helf- / hilf-",
    forms: {
      ich: "helfe",
      du: "hilfst",
      er: "hilft",
      wir: "helfen",
      ihr: "helft",
      sie: "helfen"
    },
    principalParts: "hilft · half · hat geholfen",
    ruleTip: "Ünlü değişimi (e -> i) yalnızca du (hilfst) ve er/sie/es (hilft) çekimlerinde görülür; ihr helft değişmez.",
    example: {
      de: "Der Polizist hilft den Touristen.",
      tr: "Polis turistlere yardım ediyor."
    }
  }
];

export const GRAMMAR_NOTES = [
  {
    id: "note_regular",
    lesson: "Ders 2",
    level: "A1",
    badge: "Temel Kural",
    title: "Düzenli Fiil Çekim Ekleri (Präsens)",
    summary:
      "Fiillerin temel biçimine mastar (Infinitiv) denir ve fiil kökü + -en ekinden oluşur (ör. mach-en, lern-en, wohn-en, komm-en). Çekimde mastardaki -en atılır, yerine şahıs zamirine göre ek gelir.",
    table: {
      headers: ["Zamir", "Ek", "Örnek (machen)", "Türkçe"],
      rows: [
        ["ich", "-e", "ich mache", "yapıyorum"],
        ["du", "-st", "du machst", "yapıyorsun"],
        ["er / sie / es", "-t", "er macht", "o yapıyor"],
        ["wir", "-en", "wir machen", "yapıyoruz"],
        ["ihr", "-t", "ihr macht", "yapıyorsunuz (samimi)"],
        ["sie / Sie", "-en", "sie / Sie machen", "onlar yapıyor / siz yapıyorsunuz (resmi)"]
      ]
    },
    tip: "Dikkat: kommen fiilinde er/sie/es çekiminde kökteki çift m korunur: kommt (komt değil).",
    example: {
      de: "Ich mache einen Sprachkurs.",
      tr: "Dil kursuna gidiyorum."
    }
  },
  {
    id: "note_sein_haben",
    lesson: "Ders 2",
    level: "A1",
    badge: "Düzensiz",
    title: "Temel Düzensiz Fiiller: sein ve haben",
    summary:
      "Almancada en sık kullanılan iki fiil sein (olmak) ve haben (sahip olmak) düzensiz çekimlenir; ikisini tablodan bütün halinde ezberlemek gerekir.",
    table: {
      headers: ["Zamir", "sein (olmak)", "haben (sahip olmak)"],
      rows: [
        ["ich", "bin", "habe"],
        ["du", "bist", "hast"],
        ["er / sie / es", "ist", "hat"],
        ["wir", "sind", "haben"],
        ["ihr", "seid", "habt"],
        ["sie / Sie", "sind", "haben"]
      ]
    },
    tip: "Dikkat: ihr için haben çekimi hast değil, habt olur (du hast, ihr habt).",
    example: {
      de: "Du bist Emma. Ich habe keine Ahnung.",
      tr: "Sen Emma'sın. Hiçbir fikrim yok."
    }
  },
  {
    id: "note_td_rule",
    lesson: "Ders 2",
    level: "A1",
    badge: "-e- Kaynaştırma",
    title: "-t veya -d ile Biten Kökler: arbeiten, antworten, finden, warten",
    summary:
      "Fiil kökü -t veya -d ile bittiğinde (ör. arbeit-, antwort-, find-, wart-), du, er/sie/es ve ihr çekimlerinde telaffuzu kolaylaştırmak için ekten önce araya bir -e- harfi girer (-est, -et, -et).",
    table: {
      headers: ["Zamir", "arbeiten", "antworten", "finden", "warten"],
      rows: [
        ["ich (-e)", "arbeite", "antworte", "finde", "warte"],
        ["du (-est)", "arbeitest", "antwortest", "findest", "wartest"],
        ["er / sie / es (-et)", "arbeitet", "antwortet", "findet", "wartet"],
        ["wir (-en)", "arbeiten", "antworten", "finden", "warten"],
        ["ihr (-et)", "arbeitet", "antwortet", "findet", "wartet"],
        ["sie / Sie (-en)", "arbeiten", "antworten", "finden", "warten"]
      ]
    },
    tip: "Özet: du -est, er/sie/es -et ve ihr -et alır; ich, wir ve sie/Sie normal ekle kalır.",
    example: {
      de: "Du arbeitest heute und er wartet im Café.",
      tr: "Bugün çalışıyorsun ve o kafede bekliyor."
    }
  },
  {
    id: "note_stem_change",
    lesson: "Ders 2",
    level: "A1",
    badge: "Kök & Zaman",
    title: "Ünlü Değişimi (e -> i) ve -ß Kuralı",
    summary:
      "Bazı güçlü fiillerde (sprechen, helfen) şimdiki zamanda yalnızca du ve er/sie/es çekimlerinde kökteki e harfi i olur. Kökü -ß ile biten heißen fiilinde ise du çekiminde ekstra -s yazılmaz.",
    table: {
      headers: ["Mastar", "du / er-sie-es", "ihr", "3 Temel Biçim (Präsens · Präteritum · Perfekt)"],
      rows: [
        ["sprechen", "sprichst / spricht", "sprecht", "spricht · sprach · hat gesprochen"],
        ["helfen", "hilfst / hilft", "helft", "hilft · half · hat geholfen"],
        ["heißen", "heißt / heißt", "heißt", "heißt · hieß · hat geheißen"]
      ]
    },
    tip: "Dikkat: heißen fiilinin geçmiş zamanı (Präteritum) hieß olur; heißt ise isim değil şimdiki zaman çekimidir.",
    example: {
      de: "Wie heißt du? Sie sprechen gut Deutsch.",
      tr: "Adın ne? Almancayı iyi konuşuyorsunuz."
    }
  },
  {
    id: "note_pronouns_questions",
    lesson: "Ders 2",
    level: "A1",
    badge: "Zamir & Soru",
    title: "Şahıs Zamirleri (Personalpronomen) ve W-Soruları",
    summary:
      "Almancada üç farklı 'o' (er/sie/es) ve samimi (du/ihr) ile resmi (Sie) ayrımı vardır. Tanışma cümlelerinde W-soru kelimeleri her zaman cümle başında yer alır.",
    table: {
      headers: ["İfade", "Kategori", "Anlam ve Kullanım"],
      rows: [
        ["er / sie / es", "3. Tekil Zamir", "er (eril: der Mann) · sie (dişil: die Frau) · es (nötr: das Auto)"],
        ["Sie", "Resmi Hitap", "Cümle ortasında daima büyük yazılır; fiili -en alır (Wo wohnen Sie?)"],
        ["wer / was / wie", "Soru Kelimesi", "wer = kim · was = ne · wie = nasıl (Wie heißen Sie?)"],
        ["wo / woher", "Yer vs. Köken", "wo = nerede (Wo wohnst du?) · woher = nereden (Woher kommst du?)"]
      ]
    },
    tip: "Sık karışan nokta: wo 'nerede', woher 'nereden' demektir (Ich wohne in Sevilla / Ich komme aus Spanien).",
    example: {
      de: "Woher kommst du und wo wohnst du jetzt?",
      tr: "Nereden geliyorsun ve şimdi nerede oturuyorsun?"
    }
  },
  {
    id: "note_wer_was",
    lesson: "Ders 4",
    level: "A1",
    badge: "Soru",
    title: "Soru Sözcükleri: wer (Kişi) ve was (Nesne / Olay)",
    summary:
      "İnsanlar hakkında soru soruluyorsa wer (kim), insanlar dışındaki nesneler, kavramlar veya eylemler hakkında soru soruluyorsa was (ne) soru sözcüğü kullanılır.",
    table: {
      headers: ["Soru Sözcüğü", "Kullanım Alanı", "Örnek Soru", "Örnek Cevap"],
      rows: [
        ["wer (kim)", "İnsanlar / kişiler için", "Wer ist denn das?", "Das ist Lukas."],
        ["was (ne)", "Nesneler, kavramlar ve eylemler için", "Was machst du hier?", "Ich trinke einen Tee."]
      ]
    },
    tip: "Kısa kural: Cevapta bir kişi varsa wer, bir eşya, kavram veya eylem varsa was kullanılır.",
    example: {
      de: "Wer ist denn das? Und was ist das auf dem Tisch?",
      tr: "Bu da kim? Ve masanın üzerindeki bu şey ne?"
    }
  },
  {
    id: "note_grammar_terms",
    lesson: "Ders 4",
    level: "A1",
    badge: "Terimler",
    title: "Temel Dil Bilgisi Terimleri: Nomen, Artikel ve Genus",
    summary:
      "Almanca isimlerin yapısını ve artikellerini anlamak için üç temel dil bilgisi terimi kullanılır: das Nomen (isim), der Artikel (artikel) ve das Genus (dil bilgisel cinsiyet).",
    table: {
      headers: ["Terim", "Diğer Adı / Türler", "Açıklama", "Örnek"],
      rows: [
        [
          "das Nomen",
          "das Substantiv / das Hauptwort",
          "Canlıları, eşyaları veya olguları isim olarak tanımlar; Almancada isimler daima büyük harfle başlar.",
          "das Flugzeug, die Lampe"
        ],
        [
          "der Artikel",
          "der · die · das",
          "İsimden önce gelen ve isme eşlik eden sözcüklerdir; ismin dil bilgisel cinsiyetini gösterir.",
          "der Mann, die Party, das Land"
        ],
        [
          "das Genus",
          "maskulin · feminin · neutral",
          "Her ismin belirli bir dil bilgisel cinsiyeti vardır: eril (maskulin -> der), dişil (feminin -> die), nötr (neutral -> das).",
          "der Kaffee (m) · die Lampe (f) · das Getränk (n)"
        ]
      ]
    },
    tip: "Dikkat: Almancada dil bilgisel cinsiyet (Genus) biyolojik cinsiyetten bağımsız olabilir; bu yüzden her ismi artikeliyle birlikte ezberlemek gerekir.",
    example: {
      de: "Die Lampe ist feminin, das Flugzeug ist neutral.",
      tr: "Lamba dişil (die), uçak nötr (das) cinsiyettedir."
    }
  }
];
