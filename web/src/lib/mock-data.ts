import type {
  Actor,
  Answers,
  Coverage,
  InternItem,
  MetricComparison,
  MockState,
  Question,
  Survey,
  SurveyAudience,
  SurveyResponse,
  TrendPoint,
} from "./types";

export const periods = Array.from({ length: 6 }, (_, index) => `Месяц ${index + 1}`);
export const departments = ["Технический", "Коммерческий", "Административный", "HR-блок", "IT"];

export const actors: Actor[] = [
  { id: "a-hr", name: "Анна Соколова", role: "hr", initials: "АС", title: "HR-директор программы" },
  { id: "a-manager", name: "Павел Орлов", role: "manager", initials: "ПО", title: "Руководитель программы" },
  { id: "a-mentor", name: "Марина Белова", role: "mentor", team_id: "technical", initials: "МБ", title: "Наставник · 2 стажёра" },
  { id: "a-intern", name: "Лев Волков", role: "intern", internship_id: "i-1", team_id: "technical", initials: "ЛВ", title: "Стажёр · Технический блок" },
];

export const internQuestions: Question[] = [
  { id: "task_clarity", type: "scale", title: "Мне понятно, каких результатов от меня ожидают по текущим задачам.", required: true, dimension: "task_clarity", min: 1, max: 5, options: [] },
  { id: "mentor_support", type: "scale", title: "Я получаю достаточно поддержки и обратной связи от наставника.", required: true, dimension: "mentor_support", min: 1, max: 5, options: [] },
  { id: "workload_comfort", type: "scale", title: "Моя текущая загрузка комфортна и позволяет качественно выполнять задачи.", required: true, dimension: "workload_comfort", min: 1, max: 5, options: [] },
  { id: "task_interest", type: "scale", title: "Мне интересны задачи, над которыми я работаю.", required: true, dimension: "task_interest", min: 1, max: 5, options: [] },
  { id: "professional_growth", type: "scale", title: "Я чувствую, что в процессе стажировки развиваю полезные для себя навыки.", required: true, dimension: "professional_growth", min: 1, max: 5, options: [] },
  { id: "team_interaction", type: "scale", title: "Мне комфортно взаимодействовать с командой.", required: true, dimension: "team_interaction", min: 1, max: 5, options: [] },
  { id: "satisfaction", type: "scale", title: "В целом я доволен тем, как проходит моя стажировка.", required: true, dimension: "satisfaction", min: 1, max: 5, options: [] },
  { id: "difficulties", type: "text", title: "С какими сложностями вы столкнулись за последний период стажировки?", required: false, dimension: "difficulties", min: 1, max: 5, options: [] },
  { id: "obstacles", type: "text", title: "Есть ли что-то в задачах, взаимодействии с наставником или командой, что сейчас мешает вам эффективно работать и развиваться?", required: false, dimension: "obstacles", min: 1, max: 5, options: [] },
];

export const mentorQuestions: Question[] = [
  { id: "task_understanding", type: "scale", title: "Насколько стажер понимает поставленные задачи и ожидаемый результат?", required: true, dimension: "task_understanding", min: 1, max: 5, options: [] },
  { id: "task_quality", type: "scale", title: "Насколько качественно стажер выполняет поставленные задачи?", required: true, dimension: "task_quality", min: 1, max: 5, options: [] },
  { id: "independence", type: "scale", title: "Насколько самостоятельно стажер выполняет поставленные задачи?", required: true, dimension: "independence", min: 1, max: 5, options: [] },
  { id: "deadlines_organization", type: "scale", title: "Насколько стажер соблюдает сроки и организует свою работу?", required: true, dimension: "deadlines_organization", min: 1, max: 5, options: [] },
  { id: "engagement_initiative", type: "scale", title: "Насколько стажер вовлечен в работу и проявляет инициативу?", required: true, dimension: "engagement_initiative", min: 1, max: 5, options: [] },
  { id: "mentor_team_interaction", type: "scale", title: "Насколько эффективно стажер взаимодействует с наставником и командой?", required: true, dimension: "mentor_team_interaction", min: 1, max: 5, options: [] },
  { id: "work_comment", type: "text", title: "Опишите, как стажер проявил себя за последний период: что получилось хорошо и с какими сложностями он столкнулся?", required: false, dimension: "work_comment", min: 1, max: 5, options: [] },
  { id: "attention_situations", type: "text", title: "Есть ли сложности или ситуации, на которые, по вашему мнению, стоит обратить внимание? Если да, кратко опишите.", required: false, dimension: "attention_situations", min: 1, max: 5, options: [] },
];

const internSeed = [
  { id: "i-1", sourceId: "СТ-001", name: "Лев Волков", initials: "ЛВ", actorId: "u-lev", department: "Технический", mentor: "Марина Белова", manager: "Павел Орлов" },
  { id: "i-2", sourceId: "СТ-002", name: "Ирина Ким", initials: "ИК", actorId: "u-ira", department: "Коммерческий", mentor: "Марина Белова", manager: "Павел Орлов" },
  { id: "i-3", sourceId: "СТ-003", name: "Алексей Морозов", initials: "АМ", actorId: "u-alex", department: "Административный", mentor: "Игорь Смирнов", manager: "Ольга Лебедева" },
  { id: "i-4", sourceId: "СТ-004", name: "Софья Ларина", initials: "СЛ", actorId: "u-sofia", department: "HR-блок", mentor: "Елена Рябова", manager: "Тимур Валиев" },
  { id: "i-5", sourceId: "СТ-005", name: "Максим Осипов", initials: "МО", actorId: "u-max", department: "IT", mentor: "Роман Захаров", manager: "Наталья Егорова" },
] as const;

const internScores: number[][][] = [
  [[4,4,3,5,4,4,4],[4,4,4,5,4,4,4],[5,4,4,5,5,4,5],[5,5,4,5,5,5,5],[5,5,5,5,5,5,5],[5,5,5,5,5,5,5]],
  [[5,5,4,5,4,5,5],[5,5,4,5,4,5,5],[5,5,5,5,5,5,5],[5,5,4,5,5,5,5],[5,5,5,5,5,5,5],[5,5,5,5,5,5,5]],
  [[3,3,4,3,3,4,3],[3,2,4,3,3,4,3],[2,2,3,3,3,4,2],[4,4,4,4,4,4,4],[4,4,4,4,4,5,4],[5,4,5,4,5,5,5]],
  [[4,5,5,4,5,5,5],[5,5,5,5,5,5,5],[5,5,4,5,5,5,5],[5,5,2,5,5,5,4],[5,5,4,5,5,5,5],[5,5,5,5,5,5,5]],
  [[2,2,4,5,5,3,3],[2,2,3,5,5,3,3],[3,2,3,5,5,3,3],[4,4,4,5,5,4,4],[4,4,4,5,5,5,5],[5,5,4,5,5,5,5]],
];
const mentorScores: number[][][] = [
  [[4,4,3,4,4,4],[4,4,4,4,4,4],[5,4,4,5,5,4],[5,5,4,5,5,5],[5,5,5,5,5,5],[5,5,5,5,5,5]],
  [[5,4,4,5,5,5],[5,5,4,5,5,5],[5,5,5,5,5,5],[5,5,5,4,5,5],[5,5,5,5,5,5],[5,5,5,5,5,5]],
  [[3,4,3,4,3,4],[3,3,3,3,3,4],[3,3,2,3,3,4],[4,4,4,4,4,4],[4,4,4,4,4,5],[5,4,5,5,5,5]],
  [[4,5,5,5,4,5],[5,5,5,5,5,5],[5,5,5,5,5,5],[5,5,5,4,5,5],[5,5,5,5,5,5],[5,5,5,5,5,5]],
  [[4,4,2,3,5,3],[4,4,2,3,5,3],[4,4,3,3,5,3],[4,4,4,4,5,4],[5,5,4,5,5,5],[5,5,5,5,5,5]],
];

const internDifficulties = [
  ["Сложно распределять время между несколькими задачами.","По новым задачам иногда не сразу понятны приоритеты.","Сложности возникают только на новых технических задачах.","Серьезных сложностей нет.","Сложностей за период не было.","Сложностей за период не было."],
  ["Потребовалось время, чтобы разобраться во внутренних процессах.","Существенных сложностей нет.","Сложностей за период не было.","В отдельные дни было много параллельных задач.","Сложностей за период не было.","Сложностей за период не было."],
  ["По новым задачам не всегда понятен ожидаемый результат.","Часто приходится повторно уточнять требования по задачам.","Часть задач пришлось переделывать из-за непонятной постановки.","После регулярных встреч задачи стали понятнее.","По новым задачам иногда нужны дополнительные уточнения.","Серьезных сложностей нет."],
  ["Потребовалось время на освоение внутренних систем.","Сложностей за период не было.","Стало больше параллельных задач.","Нагрузка была слишком высокой из-за нескольких проектов одновременно.","Нагрузка вернулась к комфортному уровню.","Сложностей за период не было."],
  ["Не всегда понятны приоритеты по задачам.","Некоторые задачи задерживаются, потому что долго жду уточнений.","Задачи стали понятнее, но обратной связи все еще недостаточно.","После регулярных встреч стало проще решать сложные вопросы.","Сложности возникают только по новым техническим задачам.","Серьезных сложностей нет."],
];
const internObstacles = [
  ["Нужно быстрее получать обратную связь по промежуточным результатам.","Иногда не хватает короткой сверки с наставником по новым задачам.","Нужна помощь наставника по отдельным сложным вопросам.","Хотелось бы больше задач повышенной сложности.","Ничего не мешает работать и развиваться.","Ничего не мешает работать и развиваться."],
  ["Хотелось бы больше самостоятельных задач.","Хотелось бы чаще участвовать во встречах команды.","Хотелось бы больше задач, где можно самостоятельно принимать решения.","Иногда нагрузка выше комфортной.","Ничего не мешает работать и развиваться.","Хотелось бы больше ответственных задач."],
  ["Не хватает регулярной обратной связи по выполненным задачам.","Не хватает регулярной связи с наставником.","Мешают неясные задачи и редкая обратная связь.","Существенных сложностей сейчас нет.","Иногда требуется быстрее согласовывать приоритеты.","Ничего существенно не мешает работе."],
  ["Хотелось бы больше аналитических задач.","Ничего не мешает работать и развиваться.","Нужно внимательнее планировать загрузку.","Основная сложность — высокая нагрузка; по задачам и взаимодействию проблем нет.","Существенных сложностей нет.","Хотелось бы продолжать развиваться в аналитических задачах."],
  ["Не хватает регулярной обратной связи от наставника.","Не хватает возможности быстро задать вопрос наставнику.","Хотелось бы регулярных коротких встреч с наставником.","Иногда все еще приходится ждать ответа по сложным задачам.","Существенных препятствий нет.","Ничего не мешает работать и развиваться."],
];
const mentorComments = [
  ["Хорошо понимает задачи и качественно их выполняет. Пока нужна помощь с планированием.","Стало лучше с планированием, по новым задачам задает нужные вопросы.","Хорошо справляется с задачами и проявляет инициативу.","Стабильно выполняет задачи качественно и в срок.","Работает самостоятельно, качественно и в срок.","Показывает стабильный высокий результат по всем критериям."],
  ["Быстро включился в работу, активен и хорошо взаимодействует с командой.","Качественно выполняет задачи и проявляет инициативу.","Полностью самостоятельно ведет текущие задачи.","Сохраняет высокое качество при высокой загрузке.","Стабильно показывает высокий результат.","Готов самостоятельно вести более ответственные задачи."],
  ["Задачи выполняет аккуратно, но по новым задачам часто нужны уточнения.","Из-за повторных уточнений снизился темп выполнения задач.","Самостоятельность снизилась, по ряду задач требовались дополнительные пояснения.","После регулярных встреч стал лучше понимать задачи и работать увереннее.","Стабильно выполняет задачи, взаимодействие с командой хорошее.","Заметно выросла самостоятельность и уверенность в работе."],
  ["Работает самостоятельно, качественно и хорошо взаимодействует с командой.","Показывает высокий результат по всем критериям.","Хорошо справляется с увеличившимся количеством задач.","Качество работы осталось высоким, но из-за нагрузки часть сроков пришлось перенести.","После снижения нагрузки снова работает в стабильном темпе.","Стабильно показывает высокий результат и проявляет инициативу."],
  ["Технически сильный и вовлеченный, но пока часто нуждается в помощи по организации работы.","Качество работы хорошее, но часть задач задерживается из-за поздних уточнений.","Самостоятельность немного выросла, но по сложным задачам все еще нужна поддержка.","После регулярных встреч стал быстрее решать сложные вопросы и лучше соблюдать сроки.","Хорошо справляется с задачами и своевременно сообщает о сложностях.","Показывает стабильный высокий результат и работает самостоятельно."],
];
const mentorAttention = [
  ["Стоит развивать самостоятельное планирование работы.","Критичных сложностей нет.","По сложным задачам пока требуется поддержка наставника.","Можно постепенно увеличивать самостоятельность.","Сложностей, требующих внимания, нет.","Сложностей, требующих внимания, нет."],
  ["Можно давать больше самостоятельных задач.","Критичных сложностей нет.","Можно подключать к более сложным задачам.","Стоит следить за нагрузкой в пиковые периоды.","Сложностей, требующих внимания, нет.","Сложностей, требующих внимания, нет."],
  ["Нужно точнее формулировать задачи и чаще давать обратную связь.","Нужны регулярные короткие сверки по задачам.","Нужно улучшить постановку задач и регулярность обратной связи.","Ситуация улучшилась, критичных сложностей нет.","Можно сохранять текущий формат работы.","Сложностей, требующих внимания, нет."],
  ["Можно подключать к большему числу аналитических задач.","Сложностей, требующих внимания, нет.","Стоит продолжать следить за нагрузкой.","Нужно снизить нагрузку; других проблем нет.","Сложностей, требующих внимания, нет.","Можно развивать в сторону более сложных аналитических задач."],
  ["Нужно чаще обсуждать сложные вопросы и своевременно просить помощь.","Нужна более регулярная связь с наставником.","Стоит ввести регулярные короткие встречи.","Ситуация улучшается, текущий формат стоит сохранить.","Критичных сложностей нет.","Сложностей, требующих внимания, нет."],
];

const submittedAt = (month: number, hour: number) => new Date(Date.UTC(2026, month + 4, 24, hour, 0, 0)).toISOString();
const scaleAnswers = (questions: Question[], values: number[]): Answers => Object.fromEntries(questions.filter((question) => question.type === "scale").map((question, index) => [question.id, values[index]]));

export const responses: SurveyResponse[] = internSeed.flatMap((intern, internIndex) => periods.flatMap((period, monthIndex) => {
  const common = { internship_id: intern.id, period };
  const internAnswers: Answers = {
    ...scaleAnswers(internQuestions, internScores[internIndex][monthIndex]),
    difficulties: internDifficulties[internIndex][monthIndex],
    obstacles: internObstacles[internIndex][monthIndex],
  };
  const mentorAnswers: Answers = {
    ...scaleAnswers(mentorQuestions, mentorScores[internIndex][monthIndex]),
    work_comment: mentorComments[internIndex][monthIndex],
    attention_situations: mentorAttention[internIndex][monthIndex],
  };
  return [
    { id: `r-intern-${internIndex + 1}-${monthIndex + 1}`, survey_id: `sv-intern-${monthIndex + 1}`, respondent: intern.name, role: "intern" as const, submitted_at: submittedAt(monthIndex + 1, 10), answers: internAnswers, ...common },
    { id: `r-mentor-${internIndex + 1}-${monthIndex + 1}`, survey_id: `sv-mentor-${monthIndex + 1}`, respondent: intern.mentor, role: "mentor" as const, submitted_at: submittedAt(monthIndex + 1, 15), answers: mentorAnswers, ...common },
  ];
}));

const coverage = (invited: number, submitted: number): Coverage => ({ invited, submitted, people: submitted, percent: invited ? Math.round(submitted / invited * 100) : 0 });
export const surveys: Survey[] = periods.flatMap((period, index) => (["intern", "mentor"] as SurveyAudience[]).map((audience) => {
  const month = index + 1;
  const internForm = audience === "intern";
  return {
    id: `sv-${audience}-${month}`,
    title: `${internForm ? "Пульс-опрос стажёра" : "Анкета наставника"} · ${period}`,
    description: internForm ? "Семь оценок опыта стажировки и два открытых вопроса о сложностях и препятствиях." : "Шесть оценок работы стажёра и два комментария наставника о результатах и ситуциях для внимания.",
    status: month === 6 ? "published" : "closed",
    audience,
    period,
    due_at: new Date(Date.UTC(2026, month + 4, 28, 18, 0, 0)).toISOString(),
    wave: period,
    questions: structuredClone(internForm ? internQuestions : mentorQuestions),
    coverage: coverage(5, 5),
    assignments: internSeed.map((item) => item.id),
    updated_at: submittedAt(month, 16),
  };
}));

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const rounded = (value: number | null) => value === null ? null : Math.round(value * 100) / 100;
const numericAnswers = (response: SurveyResponse) => Object.values(response.answers).filter((value): value is number => typeof value === "number");
const overallScores = internSeed.map((intern) => average(responses.filter((response) => response.internship_id === intern.id).flatMap(numericAnswers)) ?? 0);
const cohortAverage = average(overallScores);
const ranking = [...internSeed].sort((a, b) => overallScores[internSeed.indexOf(b)] - overallScores[internSeed.indexOf(a)]);

export const interns: InternItem[] = internSeed.map((intern, index) => {
  const own = responses.filter((response) => response.internship_id === intern.id);
  const latest = own.filter((response) => response.period === "Месяц 6").flatMap(numericAnswers);
  const rank = ranking.findIndex((item) => item.id === intern.id);
  const latestScore = rounded(average(latest));
  return {
    id: intern.id,
    intern: { id: intern.actorId, name: intern.name, initials: intern.initials },
    program: "Стажировка МГТС",
    cohort: "Поток 2026",
    team: intern.department,
    team_id: `department-${index + 1}`,
    stage: "Месяц 6",
    manager: intern.manager,
    mentor: intern.mentor,
    coverage: 100,
    last_activity: submittedAt(6, 15),
    latest_score: latestScore,
    overall_score: rounded(overallScores[index]),
    cohort_average: rounded(cohortAverage),
    percentile_min: Math.max(0, 100 - (rank + 1) * 20),
    percentile_max: 100 - rank * 20,
    percentile_label: `${Math.max(0, 100 - (rank + 1) * 20)}–${100 - rank * 20}`,
    traffic_light: (latestScore ?? 0) >= 4.75 ? "green" : (latestScore ?? 0) >= 4 ? "yellow" : "red",
    department: intern.department,
    current_period: "Месяц 6",
  };
});

export function trendsFor(id: string): TrendPoint[] {
  return periods.map((period) => {
    const own = responses.filter((response) => response.internship_id === id && response.period === period);
    return {
      period,
      label: period,
      intern: rounded(average(own.filter((response) => response.role === "intern").flatMap(numericAnswers))),
      mentor: rounded(average(own.filter((response) => response.role === "mentor").flatMap(numericAnswers))),
    };
  });
}

const comparisonPairs = [
  ["tasks", "Задачи и ожидания", "task_clarity", "task_understanding"],
  ["support", "Поддержка и взаимодействие", "mentor_support", "mentor_team_interaction"],
  ["workload", "Нагрузка и организация", "workload_comfort", "deadlines_organization"],
  ["engagement", "Интерес и вовлечённость", "task_interest", "engagement_initiative"],
  ["growth", "Развитие и качество", "professional_growth", "task_quality"],
  ["team", "Работа с командой", "team_interaction", "mentor_team_interaction"],
] as const;
export function metricsFor(id: string): MetricComparison[] {
  const internResponse = responses.find((response) => response.internship_id === id && response.period === "Месяц 6" && response.role === "intern");
  const mentorResponse = responses.find((response) => response.internship_id === id && response.period === "Месяц 6" && response.role === "mentor");
  return comparisonPairs.map(([id, label, internKey, mentorKey]) => ({
    id,
    label,
    intern: typeof internResponse?.answers[internKey] === "number" ? internResponse.answers[internKey] as number : null,
    mentor: typeof mentorResponse?.answers[mentorKey] === "number" ? mentorResponse.answers[mentorKey] as number : null,
  }));
}

export function coverageFor(id: string): Coverage {
  const submitted = responses.filter((response) => response.internship_id === id).length;
  return coverage(12, submitted);
}

export function createSeed(): MockState {
  return { surveys: structuredClone(surveys), responses: structuredClone(responses), drafts: {} };
}
