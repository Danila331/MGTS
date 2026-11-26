export const roleLabels = { hr: "HR", manager: "Руководитель", mentor: "Наставник", intern: "Стажёр" } as const;
export const statusLabels: Record<string, string> = {
  draft: "Черновик", published: "Опубликована", closed: "Закрыта", new: "Новый",
  confirmed: "Подтверждён", in_progress: "В работе", resolved: "Решён", dismissed: "Отклонён",
  todo: "К выполнению", done: "Выполнено", active: "Активна", ready: "Готов",
  calibrated: "Откалиброван", announced: "Объявлен", collecting: "Сбор ответов",
  completed: "Завершена", connected: "Подключён", error: "Ошибка", paused: "Пауза",
  open: "Ожидает ответа", positive: "Позитивный", neutral: "Нейтральный", growth: "Зоны роста",
};
export const urgencyLabels = { critical: "Критичный", high: "Высокий", medium: "Средний", low: "Низкий" } as const;
export const dimensionLabels: Record<string, string> = {
  goals: "Цели и задачи", task_quality: "Качество задач", mentorship: "Наставничество",
  feedback: "Обратная связь", learning: "Обучение", adaptation: "Адаптация",
  tools: "Инструменты", workload: "Нагрузка", expectations: "Ожидания",
};
export function formatDate(value?: string, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", withTime
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" }).format(date);
}
export function plural(n: number, forms: [string, string, string]) {
  const m = n % 100;
  return forms[m >= 11 && m <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];
}
export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
