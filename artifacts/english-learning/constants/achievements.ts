export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  completedAssignments: number;
  totalPoints: number;
  knowledgeLevel: string | null;
  totalTimeMinutes: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Регистрация
  {
    id: "welcome",
    emoji: "🎉",
    title: "Добро пожаловать!",
    description: "Создал аккаунт и начал учиться",
    color: "#6366f1",
    bgColor: "#ede9fe",
    check: () => true,
  },
  // Задания
  {
    id: "first_task",
    emoji: "✅",
    title: "Первый шаг",
    description: "Выполнил первое задание",
    color: "#10b981",
    bgColor: "#d1fae5",
    check: ({ completedAssignments }) => completedAssignments >= 1,
  },
  {
    id: "five_tasks",
    emoji: "📚",
    title: "Любитель знаний",
    description: "Выполнил 5 заданий",
    color: "#06b6d4",
    bgColor: "#cffafe",
    check: ({ completedAssignments }) => completedAssignments >= 5,
  },
  {
    id: "ten_tasks",
    emoji: "🏆",
    title: "Отличник",
    description: "Выполнил 10 заданий",
    color: "#f59e0b",
    bgColor: "#fef3c7",
    check: ({ completedAssignments }) => completedAssignments >= 10,
  },
  {
    id: "twenty_five_tasks",
    emoji: "💎",
    title: "Мастер заданий",
    description: "Выполнил 25 заданий",
    color: "#8b5cf6",
    bgColor: "#ede9fe",
    check: ({ completedAssignments }) => completedAssignments >= 25,
  },
  // Очки
  {
    id: "points_10",
    emoji: "⭐",
    title: "Первые очки",
    description: "Набрал 10 очков",
    color: "#f59e0b",
    bgColor: "#fef3c7",
    check: ({ totalPoints }) => totalPoints >= 10,
  },
  {
    id: "points_100",
    emoji: "🌟",
    title: "Коллекционер очков",
    description: "Набрал 100 очков",
    color: "#f59e0b",
    bgColor: "#fef3c7",
    check: ({ totalPoints }) => totalPoints >= 100,
  },
  {
    id: "points_500",
    emoji: "💫",
    title: "Звёздный ученик",
    description: "Набрал 500 очков",
    color: "#f59e0b",
    bgColor: "#fef3c7",
    check: ({ totalPoints }) => totalPoints >= 500,
  },
  // Уровни знаний
  {
    id: "level_starter",
    emoji: "🌱",
    title: "Стартовый уровень",
    description: "Начал обучение — уровень Стартовый",
    color: "#8b5cf6",
    bgColor: "#ede9fe",
    check: ({ knowledgeLevel }) =>
      ["starter", "beginner", "elementary", "intermediate", "upper_intermediate"].includes(knowledgeLevel ?? ""),
  },
  {
    id: "level_beginner",
    emoji: "🌿",
    title: "Начинающий",
    description: "Достиг уровня Начинающий",
    color: "#06b6d4",
    bgColor: "#cffafe",
    check: ({ knowledgeLevel }) =>
      ["beginner", "elementary", "intermediate", "upper_intermediate"].includes(knowledgeLevel ?? ""),
  },
  {
    id: "level_elementary",
    emoji: "🌳",
    title: "Элементарный",
    description: "Достиг уровня Элементарный",
    color: "#10b981",
    bgColor: "#d1fae5",
    check: ({ knowledgeLevel }) =>
      ["elementary", "intermediate", "upper_intermediate"].includes(knowledgeLevel ?? ""),
  },
  {
    id: "level_intermediate",
    emoji: "🔥",
    title: "Средний уровень",
    description: "Достиг уровня Средний",
    color: "#f59e0b",
    bgColor: "#fef3c7",
    check: ({ knowledgeLevel }) =>
      ["intermediate", "upper_intermediate"].includes(knowledgeLevel ?? ""),
  },
  {
    id: "level_upper",
    emoji: "🚀",
    title: "Продвинутый",
    description: "Достиг уровня Продвинутый!",
    color: "#ef4444",
    bgColor: "#fee2e2",
    check: ({ knowledgeLevel }) => knowledgeLevel === "upper_intermediate",
  },
  // Время
  {
    id: "time_30",
    emoji: "⏱️",
    title: "Начало пути",
    description: "Провёл в приложении 30 минут",
    color: "#6366f1",
    bgColor: "#ede9fe",
    check: ({ totalTimeMinutes }) => totalTimeMinutes >= 30,
  },
  {
    id: "time_120",
    emoji: "⏰",
    title: "Усердный ученик",
    description: "Провёл в приложении 2 часа",
    color: "#6366f1",
    bgColor: "#ede9fe",
    check: ({ totalTimeMinutes }) => totalTimeMinutes >= 120,
  },
  {
    id: "time_600",
    emoji: "🕰️",
    title: "Настоящий марафонец",
    description: "Провёл в приложении 10 часов",
    color: "#6366f1",
    bgColor: "#ede9fe",
    check: ({ totalTimeMinutes }) => totalTimeMinutes >= 600,
  },
];

export function getUnlockedAchievements(stats: AchievementStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.check(stats));
}

export function getLockedAchievements(stats: AchievementStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !a.check(stats));
}
