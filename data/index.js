import { lesson01 } from "./lesson_01.js";

export const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"];
export const LESSONS = [lesson01];

const seenIds = new Set();

export const ALL_WORDS = LESSONS.flatMap((lesson) =>
  lesson.items
    .filter((item) => {
      if (seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);
      return true;
    })
    .map((item) => ({
      ...item,
      level: lesson.level || "A1",
      lessonId: lesson.id,
      lesson: lesson.title
    }))
);

export function getLessonList() {
  return LESSONS.map(({ id, level, title, subtitle }) => ({
    id,
    level: level || "A1",
    title,
    subtitle,
    count: ALL_WORDS.filter((item) => item.lessonId === id).length
  }));
}

export function getWordsForLesson(lessonFilter) {
  if (!lessonFilter || lessonFilter === "all") {
    return ALL_WORDS;
  }
  return ALL_WORDS.filter(
    (item) =>
      item.lesson === lessonFilter ||
      item.lessonId === lessonFilter ||
      item.level === lessonFilter
  );
}

export function getLevelSummary(cardsMap = {}) {
  const activeLevels = new Set(ALL_WORDS.map((item) => item.level));
  return LEVEL_ORDER.filter((level) => activeLevels.has(level)).map((level) => {
    const words = ALL_WORDS.filter((item) => item.level === level);
    let learned = 0;
    let inProgress = 0;
    let unseen = 0;

    for (const word of words) {
      const card = cardsMap[word.id];
      if (!card || !card.seen) {
        unseen += 1;
      } else if (card.box >= 4) {
        learned += 1;
      } else {
        inProgress += 1;
      }
    }

    return {
      level,
      total: words.length,
      learned,
      inProgress,
      unseen
    };
  });
}
