export const lesson04 = {
  id: "lesson_04",
  level: "A1",
  title: "Ders 4",
  subtitle: "Misafirlik, içecekler, günlük sıfatlar ve sipariş ifadeleri",
  items: [
    // İsimler (Nomen)
    {
      id: "l4_01",
      category: "noun",
      lesson: "Ders 4",
      tr: "Uçak",
      article: "das",
      singular: "Flugzeug",
      plural: "Flugzeuge",
      example: {
        de: "Das Flugzeug fliegt heute pünktlich nach Berlin.",
        tr: "Uçak bugün Berlin'e zamanında uçuyor."
      }
    },
    {
      id: "l4_02",
      category: "noun",
      lesson: "Ders 4",
      tr: "İçecek",
      article: "das",
      singular: "Getränk",
      plural: "Getränke",
      example: {
        de: "Möchtest du noch ein kaltes Getränk?",
        tr: "Soğuk bir içecek daha ister misin?"
      }
    },
    {
      id: "l4_03",
      category: "noun",
      lesson: "Ders 4",
      tr: "Lamba",
      article: "die",
      singular: "Lampe",
      plural: "Lampen",
      example: {
        de: "Die Lampe im Wohnzimmer ist sehr hell.",
        tr: "Oturma odasındaki lamba çok parlak."
      }
    },
    {
      id: "l4_04",
      category: "noun",
      lesson: "Ders 4",
      tr: "Ülke",
      article: "das",
      singular: "Land",
      plural: "Länder",
      example: {
        de: "Deutschland ist ein großes Land in Europa.",
        tr: "Almanya Avrupa'da büyük bir ülkedir."
      }
    },
    {
      id: "l4_05",
      category: "noun",
      lesson: "Ders 4",
      tr: "Parti",
      article: "die",
      singular: "Party",
      plural: "Partys",
      note: "Duden'a göre çoğul biçimi 'die Partys' şeklindedir (-s eki alır, '-ies' değil).",
      example: {
        de: "Am Samstag feiern wir eine Party bei mir.",
        tr: "Cumartesi günü bende bir parti kutluyoruz."
      }
    },

    // Fiiller (Verben)
    {
      id: "l4_06",
      category: "verb",
      lesson: "Ders 4",
      tr: "Çalışmak / İşlemek (makine, cihaz)",
      de: "funktionieren",
      hint: "Cihaz veya sistemlerin çalışması",
      note: "Düzenli fiil, '-ieren' ile bittiği için Perfekt'te 'ge-' almaz: funktioniert, funktionierte, hat funktioniert.",
      example: {
        de: "Mein altes Handy will heute nicht funktionieren.",
        tr: "Eski cep telefonum bugün çalışmak istemiyor."
      }
    },
    {
      id: "l4_07",
      category: "verb",
      lesson: "Ders 4",
      tr: "İçmek",
      de: "trinken",
      alt: ["etwas trinken"],
      note: "Düzensiz fiil (+ Akkusativ: etwas trinken): er/sie/es trinkt, Präteritum: trank, Perfekt: hat getrunken.",
      example: {
        de: "Wir trinken am Abend gern heißen Tee.",
        tr: "Akşamları severek sıcak çay içeriz."
      }
    },

    // Sıfatlar, Zarflar ve İfadeler (Adjektive, Adverbien & Wendungen)
    {
      id: "l4_08",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Memnuniyetle / Severek",
      de: "gern",
      alt: ["gerne"],
      note: "Derecelendirme (Steigerung): gern → lieber (daha çok severek) → am liebsten (en çok severek). 'gerne' yazımı da geçerlidir.",
      example: {
        de: "Ich höre am Abend gern ruhige Musik.",
        tr: "Akşamları severek sakin müzik dinlerim."
      }
    },
    {
      id: "l4_09",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Bozuk / Kırık",
      de: "kaputt",
      note: "Derecelendirme: kaputt → kaputter → am kaputtesten.",
      example: {
        de: "Die Lampe im Flur ist leider kaputt.",
        tr: "Koridordaki lamba maalesef bozuk."
      }
    },
    {
      id: "l4_10",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Güzel",
      de: "schön",
      note: "Derecelendirme: schön → schöner → am schönsten.",
      example: {
        de: "Das Wetter in München ist heute sehr schön.",
        tr: "Münih'te hava bugün çok güzel."
      }
    },
    {
      id: "l4_11",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Yeniden / Tekrar",
      de: "wieder",
      example: {
        de: "Morgen sehen wir uns im Kurs wieder.",
        tr: "Yarın kursta yeniden görüşürüz."
      }
    },
    {
      id: "l4_12",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Hoş karşılanan / Hoş geldin(iz)",
      de: "willkommen",
      hint: "Tek kelimelik sıfat",
      note: "Almancada sıfattır; genellikle 'willkommen sein' (hoş karşılanmak) veya 'Herzlich willkommen!' kalıbında kullanılır.",
      example: {
        de: "Du bist bei uns immer willkommen.",
        tr: "Bizde her zaman hoş karşılanırsın (tek kelime)."
      }
    },
    {
      id: "l4_13",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Hoş geldin! / Hoş geldiniz!",
      de: "Herzlich willkommen!",
      hint: "İki kelimelik sıcak karşılama kalıbı",
      note: "Hem samimi hem resmi karşılamalarda sıcak bir 'Hoş geldin(iz)!' ifadesi olarak kullanılır.",
      example: {
        de: "Herzlich willkommen! Komm bitte rein.",
        tr: "İçtenlikle hoş geldin! Lütfen içeri gel."
      }
    },
    {
      id: "l4_14",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Bu da kim?",
      de: "Wer ist denn das?",
      note: "'denn' burada soruya şaşkınlık veya merak tonu katan bir pekiştirme sözcüğüdür (Modalpartikel).",
      example: {
        de: "Schau mal, wer ist denn das?",
        tr: "Baksana, bu da kim?"
      }
    },
    {
      id: "l4_15",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Birbirimize sen diye hitap edelim mi?",
      de: "Wollen wir uns nicht duzen?",
      hint: "Samimi hitaba geçme teklifi",
      note: "'duzen' birine 'du' (sen) diye hitap etmek demektir; karşıtı 'siezen' (siz diye hitap etmek) fiilidir.",
      example: {
        de: "Wir arbeiten schon lange zusammen — wollen wir uns nicht duzen?",
        tr: "Uzun zamandır birlikte çalışıyoruz — birbirimize sen diye hitap edelim mi?"
      }
    },
    {
      id: "l4_16",
      category: "noun",
      lesson: "Ders 4",
      tr: "Elma suyu",
      article: "der",
      singular: "Apfelsaft",
      plural: "Apfelsäfte",
      note: "Sayıdan sonra porsiyon belirtirken tekil kullanılır: zwei Apfelsaft.",
      example: {
        de: "Zum Frühstück trinke ich gern ein Glas Apfelsaft.",
        tr: "Kahvaltıda severek bir bardak elma suyu içerim."
      }
    },
    {
      id: "l4_17",
      category: "noun",
      lesson: "Ders 4",
      tr: "Bira",
      article: "das",
      singular: "Bier",
      plural: "Biere",
      note: "Sayıdan sonra porsiyon belirtirken tekil kullanılır: zwei Bier.",
      example: {
        de: "Am Abend bestellt mein Vater ein kaltes Bier.",
        tr: "Akşam babam soğuk bir bira sipariş ediyor."
      }
    },
    {
      id: "l4_18",
      category: "noun",
      lesson: "Ders 4",
      tr: "Kola",
      article: "die",
      singular: "Cola",
      plural: "Colas",
      note: "Sayıdan sonra porsiyon belirtirken tekil kullanılır: zwei Cola.",
      example: {
        de: "Ich möchte bitte eine Cola mit Eis.",
        tr: "Lütfen buzlu bir kola istiyorum."
      }
    },
    {
      id: "l4_19",
      category: "noun",
      lesson: "Ders 4",
      tr: "Buz / Dondurma",
      article: "das",
      singular: "Eis",
      plural: "",
      onlySingular: true,
      note: "Duden'a göre yalnızca tekil kullanılır (nur Singular); bağlama göre 'buz' veya 'dondurma' anlamına gelir.",
      example: {
        de: "Möchtest du dein Getränk mit oder ohne Eis?",
        tr: "İçeceğini buzlu mu yoksa buzsuz mu istersin?"
      }
    },
    {
      id: "l4_20",
      category: "noun",
      lesson: "Ders 4",
      tr: "Bisiklet dükkânı",
      article: "der",
      singular: "Fahrradladen",
      plural: "Fahrradläden",
      example: {
        de: "Der neue Fahrradladen ist gleich um die Ecke.",
        tr: "Yeni bisiklet dükkânı hemen köşenin arkasında."
      }
    },
    {
      id: "l4_21",
      category: "noun",
      lesson: "Ders 4",
      tr: "Buzdolabı",
      article: "der",
      singular: "Kühlschrank",
      plural: "Kühlschränke",
      example: {
        de: "Die Milch steht im Kühlschrank.",
        tr: "Süt buzdolabında duruyor."
      }
    },
    {
      id: "l4_22",
      category: "noun",
      lesson: "Ders 4",
      tr: "Limonata (kısa biçim)",
      article: "die",
      singular: "Limo",
      plural: "Limos",
      hint: "Kısaltma",
      note: "'die Limonade' kelimesinin günlük dildeki kısaltmasıdır (Abkürzung).",
      example: {
        de: "Im Sommer trinke ich gern eine kalte Limo.",
        tr: "Yazın severek soğuk bir limonata (kısa biçim) içerim."
      }
    },
    {
      id: "l4_23",
      category: "noun",
      lesson: "Ders 4",
      tr: "Limonata (uzun biçim)",
      article: "die",
      singular: "Limonade",
      plural: "Limonaden",
      note: "Günlük dilde kısaca 'die Limo' şeklinde de kullanılır.",
      example: {
        de: "Bestellen wir noch eine frische Limonade?",
        tr: "Taze bir limonata (uzun biçim) daha sipariş edelim mi?"
      }
    },
    {
      id: "l4_24",
      category: "noun",
      lesson: "Ders 4",
      tr: "Süt",
      article: "die",
      singular: "Milch",
      plural: "",
      onlySingular: true,
      note: "Duden'a göre yalnızca tekil kullanılır (nur Singular).",
      example: {
        de: "Trinkst du deinen Kaffee mit Milch?",
        tr: "Kahveni sütlü mü içiyorsun?"
      }
    },
    {
      id: "l4_25",
      category: "noun",
      lesson: "Ders 4",
      tr: "Portakal suyu",
      article: "der",
      singular: "Orangensaft",
      plural: "Orangensäfte",
      note: "Sayıdan sonra porsiyon belirtirken tekil kullanılır: zwei Orangensaft.",
      example: {
        de: "Morgens nehme ich immer einen frischen Orangensaft.",
        tr: "Sabahları her zaman taze bir portakal suyu alırım."
      }
    },
    {
      id: "l4_26",
      category: "noun",
      lesson: "Ders 4",
      tr: "Meyve suyu",
      article: "der",
      singular: "Saft",
      plural: "Säfte",
      note: "Sayıdan sonra genellikle tekil kullanılır: zwei Saft.",
      example: {
        de: "Welchen Saft trinkst du am liebsten?",
        tr: "En çok hangi meyve suyunu seversin?"
      }
    },
    {
      id: "l4_27",
      category: "noun",
      lesson: "Ders 4",
      tr: "Menü / Yemek listesi",
      article: "die",
      singular: "Speisekarte",
      plural: "Speisekarten",
      example: {
        de: "Entschuldigung, können wir bitte die Speisekarte haben?",
        tr: "Affedersiniz, lütfen menüyü alabilir miyiz?"
      }
    },
    {
      id: "l4_28",
      category: "noun",
      lesson: "Ders 4",
      tr: "Çay",
      article: "der",
      singular: "Tee",
      plural: "Tees",
      note: "Sayıdan sonra porsiyon belirtirken tekil kullanılır: zwei Tee.",
      example: {
        de: "Im Winter trinke ich abends gern heißen Tee.",
        tr: "Kışın akşamları severek sıcak çay içerim."
      }
    },
    {
      id: "l4_29",
      category: "noun",
      lesson: "Ders 4",
      tr: "Su",
      article: "das",
      singular: "Wasser",
      plural: "",
      onlySingular: true,
      note: "Duden'a göre yalnızca tekil kullanılır (nur Singular).",
      example: {
        de: "Ich hätte gern ein Glas Wasser ohne Eis.",
        tr: "Buzsuz bir bardak su rica ediyorum."
      }
    },
    {
      id: "l4_30",
      category: "noun",
      lesson: "Ders 4",
      tr: "Şarap",
      article: "der",
      singular: "Wein",
      plural: "Weine",
      note: "Sayıdan sonra porsiyon belirtirken tekil kullanılır: zwei Wein.",
      example: {
        de: "Zum Abendessen trinken sie ein Glas Wein.",
        tr: "Akşam yemeğinde bir kadeh şarap içiyorlar."
      }
    },
    {
      id: "l4_31",
      category: "noun",
      lesson: "Ders 4",
      tr: "Şeker",
      article: "der",
      singular: "Zucker",
      plural: "",
      onlySingular: true,
      note: "Duden'a göre yalnızca tekil kullanılır (nur Singular).",
      example: {
        de: "Ich trinke meinen Kaffee immer ohne Zucker.",
        tr: "Kahvemi her zaman şekersiz (şeker olmadan) içerim."
      }
    },
    {
      id: "l4_32",
      category: "verb",
      lesson: "Ders 4",
      tr: "Tanımak / Bilmek (kişi, yer, şey)",
      de: "kennen",
      alt: ["jemanden kennen", "etwas kennen"],
      note: "Düzensiz fiil (+ Akkusativ: jemanden/etwas kennen): er/sie/es kennt, Präteritum: kannte, Perfekt: hat gekannt.",
      example: {
        de: "Wir kennen diese Stadt schon sehr gut.",
        tr: "Bu şehri zaten çok iyi tanıyoruz."
      }
    },
    {
      id: "l4_33",
      category: "verb",
      lesson: "Ders 4",
      tr: "İstemek (kibar)",
      de: "möchten",
      alt: ["möchte"],
      hint: "Kibar istek fiili",
      note: "Kibar istek belirtmek için kullanılır (mögen fiilinin Konjunktiv II biçimi): ich/er/sie/es möchte, geçmiş zamanı: wollte.",
      example: {
        de: "Wir möchten bitte zwei Kaffee bestellen.",
        tr: "Lütfen iki kahve sipariş etmek istiyoruz."
      }
    },
    {
      id: "l4_34",
      category: "verb",
      lesson: "Ders 4",
      tr: "Almak",
      de: "nehmen",
      alt: ["etwas nehmen"],
      note: "Düzensiz fiil (+ Akkusativ: etwas nehmen): du nimmst, er/sie/es nimmt, Präteritum: nahm, Perfekt: hat genommen.",
      example: {
        de: "Wir nehmen heute ein großes Wasser und einen Tee.",
        tr: "Bugün büyük bir su ve bir çay alıyoruz."
      }
    },
    {
      id: "l4_35",
      category: "verb",
      lesson: "Ders 4",
      tr: "Paylaşmak (sosyal medya)",
      de: "posten",
      alt: ["etwas posten"],
      hint: "Sosyal medyada gönderi paylaşmak",
      note: "Kök -t ile bittiği için -e- kaynaştırması alır: er/sie/es postet, Präteritum: postete, Perfekt: hat gepostet.",
      example: {
        de: "Viele junge Leute posten gern Fotos von ihrer Reise.",
        tr: "Birçok genç insan gezilerinden fotoğrafları severek (sosyal medyada) paylaşır."
      }
    },
    {
      id: "l4_36",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Bir fikrim var.",
      de: "Ich habe eine Idee.",
      example: {
        de: "Warte kurz, ich habe eine Idee!",
        tr: "Biraz bekle, bir fikrim var!"
      }
    },
    {
      id: "l4_37",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Tercihen / Daha ziyade",
      de: "lieber",
      note: "'gern' zarfının karşılaştırma (Komparativ) biçimidir: gern → lieber → am liebsten.",
      example: {
        de: "Ich trinke heute lieber einen Apfelsaft statt Cola.",
        tr: "Bugün kola yerine tercihen bir elma suyu içerim."
      }
    },
    {
      id: "l4_38",
      category: "phrase",
      lesson: "Ders 4",
      tr: "İle",
      de: "mit",
      note: "Daima Dativ ile kullanılır: mit Milch, mit Zucker.",
      example: {
        de: "Ich trinke meinen Kaffee gern mit Milch.",
        tr: "Kahvemi severek süt ile içerim."
      }
    },
    {
      id: "l4_39",
      category: "phrase",
      lesson: "Ders 4",
      tr: "-sız / -siz / Olmadan",
      de: "ohne",
      note: "Daima Akkusativ ile kullanılır: ohne Zucker, ohne Eis.",
      example: {
        de: "Er trinkt seinen Tee immer ohne Zucker.",
        tr: "Çayını her zaman şekersiz (şeker olmadan) içer."
      }
    },
    {
      id: "l4_40",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Çok",
      de: "viel",
      note: "Derecelendirme (Steigerung): viel → mehr → am meisten.",
      example: {
        de: "Im Sommer trinke ich jeden Tag viel Wasser.",
        tr: "Yazın her gün çok su içerim."
      }
    },
    {
      id: "l4_41",
      category: "phrase",
      lesson: "Ders 4",
      tr: "Az",
      de: "wenig",
      note: "Derecelendirme (Steigerung): wenig → weniger → am wenigsten.",
      example: {
        de: "Ich nehme nur wenig Zucker in meinen Tee.",
        tr: "Çayıma sadece az şeker alırım."
      }
    }
  ]
};
