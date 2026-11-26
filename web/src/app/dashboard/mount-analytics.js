// Port of the interactive dashboard from aidashboard (206f65f).
export function mountAnalytics(root) {
  const metrics = [
    'Понимание задач', 'Качество работы', 'Самостоятельность',
    'Соблюдение сроков', 'Инициативность', 'Работа с командой'
  ];
  const organizerPopulation = [
    {
      id: "СТ-001",
      name: "СТ-001",
      mentor: [[4, 4, 3, 4, 4, 4], [4, 4, 4, 4, 4, 4], [5, 4, 4, 5, 5, 4], [5, 5, 4, 5, 5, 5], [5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5]],
      intern: [[4, 4, 3, 5, 4, 4, 4], [4, 4, 4, 5, 4, 4, 4], [5, 4, 4, 5, 5, 4, 5], [5, 5, 4, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5, 5]],
      texts: [
        {"mentor": ["Хорошо понимает задачи и качественно их выполняет. Пока нужна помощь с планированием.", "Стоит развивать самостоятельное планирование работы."], "intern": ["Сложно распределять время между несколькими задачами.", "Нужно быстрее получать обратную связь по промежуточным результатам."]},
        {"mentor": ["Стало лучше с планированием, по новым задачам задает нужные вопросы.", "Критичных сложностей нет."], "intern": ["По новым задачам иногда не сразу понятны приоритеты.", "Иногда не хватает короткой сверки с наставником по новым задачам."]},
        {"mentor": ["Хорошо справляется с задачами и проявляет инициативу.", "По сложным задачам пока требуется поддержка наставника."], "intern": ["Сложности возникают только на новых технических задачах.", "Нужна помощь наставника по отдельным сложным вопросам."]},
        {"mentor": ["Стабильно выполняет задачи качественно и в срок.", "Можно постепенно увеличивать самостоятельность."], "intern": ["Серьезных сложностей нет.", "Хотелось бы больше задач повышенной сложности."]},
        {"mentor": ["Работает самостоятельно, качественно и в срок.", "Сложностей, требующих внимания, нет."], "intern": ["Сложностей за период не было.", "Ничего не мешает работать и развиваться."]},
        {"mentor": ["Показывает стабильный высокий результат по всем критериям.", "Сложностей, требующих внимания, нет."], "intern": ["Сложностей за период не было.", "Ничего не мешает работать и развиваться."]},
      ],
      ai: [
        {"topic": "планирование времени", "answer": {"s": {"status": "issue", "quotes": ["Сложно распределять время между несколькими задачами."]}, "n": {"status": "issue", "quotes": ["Пока нужна помощь с планированием.", "Стоит развивать самостоятельное планирование работы."]}}},
        {"topic": "планирование работы", "answer": {"s": {"status": "issue", "quotes": ["По новым задачам иногда не сразу понятны приоритеты.", "Иногда не хватает короткой сверки с наставником по новым задачам."]}, "n": {"status": "better", "quotes": ["Стало лучше с планированием, по новым задачам задает нужные вопросы."]}}},
        {"topic": "поддержка по сложным задачам", "answer": {"s": {"status": "issue", "quotes": ["Нужна помощь наставника по отдельным сложным вопросам.", "Сложности возникают только на новых технических задачах."]}, "n": {"status": "issue", "quotes": ["По сложным задачам пока требуется поддержка наставника."]}}},
        {"topic": "более сложные задачи", "answer": {"s": {"status": "growth", "quotes": ["Хотелось бы больше задач повышенной сложности."]}, "n": {"status": "none", "quotes": []}}},
        {"topic": "текущие трудности", "answer": {"s": {"status": "none", "quotes": []}, "n": {"status": "none", "quotes": []}}},
        {"topic": "текущие трудности", "answer": {"s": {"status": "none", "quotes": []}, "n": {"status": "none", "quotes": []}}},
      ],
    },
    {
      id: "СТ-002",
      name: "СТ-002",
      mentor: [[5, 4, 4, 5, 5, 5], [5, 5, 4, 5, 5, 5], [5, 5, 5, 5, 5, 5], [5, 5, 5, 4, 5, 5], [5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5]],
      intern: [[5, 5, 4, 5, 4, 5, 5], [5, 5, 4, 5, 4, 5, 5], [5, 5, 5, 5, 5, 5, 5], [5, 5, 4, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5, 5]],
      texts: [
        {"mentor": ["Быстро включился в работу, активен и хорошо взаимодействует с командой.", "Можно давать больше самостоятельных задач."], "intern": ["Потребовалось время, чтобы разобраться во внутренних процессах.", "Хотелось бы больше самостоятельных задач."]},
        {"mentor": ["Качественно выполняет задачи и проявляет инициативу.", "Критичных сложностей нет."], "intern": ["Существенных сложностей нет.", "Хотелось бы чаще участвовать во встречах команды."]},
        {"mentor": ["Полностью самостоятельно ведет текущие задачи.", "Можно подключать к более сложным задачам."], "intern": ["Сложностей за период не было.", "Хотелось бы больше задач, где можно самостоятельно принимать решения."]},
        {"mentor": ["Сохраняет высокое качество при высокой загрузке.", "Стоит следить за нагрузкой в пиковые периоды."], "intern": ["В отдельные дни было много параллельных задач.", "Иногда нагрузка выше комфортной."]},
        {"mentor": ["Стабильно показывает высокий результат.", "Сложностей, требующих внимания, нет."], "intern": ["Сложностей за период не было.", "Ничего не мешает работать и развиваться."]},
        {"mentor": ["Готов самостоятельно вести более ответственные задачи.", "Сложностей, требующих внимания, нет."], "intern": ["Сложностей за период не было.", "Хотелось бы больше ответственных задач."]},
      ],
      ai: [
        {"topic": "больше самостоятельных задач", "answer": {"s": {"status": "growth", "quotes": ["Хотелось бы больше самостоятельных задач."]}, "n": {"status": "growth", "quotes": ["Можно давать больше самостоятельных задач."]}}},
        {"topic": "участие во встречах команды", "answer": {"s": {"status": "issue", "quotes": ["Хотелось бы чаще участвовать во встречах команды."]}, "n": {"status": "none", "quotes": []}}},
        {"topic": "более самостоятельные или сложные задачи", "answer": {"s": {"status": "growth", "quotes": ["Хотелось бы больше задач, где можно самостоятельно принимать решения."]}, "n": {"status": "growth", "quotes": ["Можно подключать к более сложным задачам."]}}},
        {"topic": "высокая нагрузка", "answer": {"s": {"status": "issue", "quotes": ["В отдельные дни было много параллельных задач.", "Иногда нагрузка выше комфортной."]}, "n": {"status": "issue", "quotes": ["Стоит следить за нагрузкой в пиковые периоды."]}}},
        {"topic": "текущие трудности", "answer": {"s": {"status": "none", "quotes": []}, "n": {"status": "none", "quotes": []}}},
        {"topic": "более ответственные задачи", "answer": {"s": {"status": "growth", "quotes": ["Хотелось бы больше ответственных задач."]}, "n": {"status": "growth", "quotes": ["Готов самостоятельно вести более ответственные задачи."]}}},
      ],
    },
    {
      id: "СТ-003",
      name: "СТ-003",
      mentor: [[3, 4, 3, 4, 3, 4], [3, 3, 3, 3, 3, 4], [3, 3, 2, 3, 3, 4], [4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 5], [5, 4, 5, 5, 5, 5]],
      intern: [[3, 3, 4, 3, 3, 4, 3], [3, 2, 4, 3, 3, 4, 3], [2, 2, 3, 3, 3, 4, 2], [4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 5, 4], [5, 4, 5, 4, 5, 5, 5]],
      texts: [
        {"mentor": ["Задачи выполняет аккуратно, но по новым задачам часто нужны уточнения.", "Нужно точнее формулировать задачи и чаще давать обратную связь."], "intern": ["По новым задачам не всегда понятен ожидаемый результат.", "Не хватает регулярной обратной связи по выполненным задачам."]},
        {"mentor": ["Из-за повторных уточнений снизился темп выполнения задач.", "Нужны регулярные короткие сверки по задачам."], "intern": ["Часто приходится повторно уточнять требования по задачам.", "Не хватает регулярной связи с наставником."]},
        {"mentor": ["Самостоятельность снизилась, по ряду задач требовались дополнительные пояснения.", "Нужно улучшить постановку задач и регулярность обратной связи."], "intern": ["Часть задач пришлось переделывать из-за непонятной постановки.", "Мешают неясные задачи и редкая обратная связь."]},
        {"mentor": ["После регулярных встреч стал лучше понимать задачи и работать увереннее.", "Ситуация улучшилась, критичных сложностей нет."], "intern": ["После регулярных встреч задачи стали понятнее.", "Существенных сложностей сейчас нет."]},
        {"mentor": ["Стабильно выполняет задачи, взаимодействие с командой хорошее.", "Можно сохранять текущий формат работы."], "intern": ["По новым задачам иногда нужны дополнительные уточнения.", "Иногда требуется быстрее согласовывать приоритеты."]},
        {"mentor": ["Заметно выросла самостоятельность и уверенность в работе.", "Сложностей, требующих внимания, нет."], "intern": ["Серьезных сложностей нет.", "Ничего существенно не мешает работе."]},
      ],
      ai: [
        {"topic": "ясность постановки задач", "answer": {"s": {"status": "issue", "quotes": ["По новым задачам не всегда понятен ожидаемый результат."]}, "n": {"status": "issue", "quotes": ["по новым задачам часто нужны уточнения.", "Нужно точнее формулировать задачи и чаще давать обратную связь."]}}},
        {"topic": "повторные уточнения требований", "answer": {"s": {"status": "issue", "quotes": ["Часто приходится повторно уточнять требования по задачам."]}, "n": {"status": "issue", "quotes": ["Из-за повторных уточнений снизился темп выполнения задач.", "Нужны регулярные короткие сверки по задачам."]}}},
        {"topic": "ясность постановки задач", "answer": {"s": {"status": "issue", "quotes": ["Часть задач пришлось переделывать из-за непонятной постановки.", "Мешают неясные задачи и редкая обратная связь."]}, "n": {"status": "issue", "quotes": ["Нужно улучшить постановку задач и регулярность обратной связи.", "по ряду задач требовались дополнительные пояснения."]}}},
        {"topic": "понимание задач после встреч", "answer": {"s": {"status": "better", "quotes": ["После регулярных встреч задачи стали понятнее."]}, "n": {"status": "better", "quotes": ["После регулярных встреч стал лучше понимать задачи и работать увереннее."]}}},
        {"topic": "необходимость уточнять задачи", "answer": {"s": {"status": "issue", "quotes": ["По новым задачам иногда нужны дополнительные уточнения."]}, "n": {"status": "none", "quotes": []}}},
        {"topic": "самостоятельность", "answer": {"s": {"status": "none", "quotes": []}, "n": {"status": "better", "quotes": ["Заметно выросла самостоятельность и уверенность в работе."]}}},
      ],
    },
    {
      id: "СТ-004",
      name: "СТ-004",
      mentor: [[4, 5, 5, 5, 4, 5], [5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5], [5, 5, 5, 4, 5, 5], [5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5]],
      intern: [[4, 5, 5, 4, 5, 5, 5], [5, 5, 5, 5, 5, 5, 5], [5, 5, 4, 5, 5, 5, 5], [5, 5, 2, 5, 5, 5, 4], [5, 5, 4, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5, 5]],
      texts: [
        {"mentor": ["Работает самостоятельно, качественно и хорошо взаимодействует с командой.", "Можно подключать к большему числу аналитических задач."], "intern": ["Потребовалось время на освоение внутренних систем.", "Хотелось бы больше аналитических задач."]},
        {"mentor": ["Показывает высокий результат по всем критериям.", "Сложностей, требующих внимания, нет."], "intern": ["Сложностей за период не было.", "Ничего не мешает работать и развиваться."]},
        {"mentor": ["Хорошо справляется с увеличившимся количеством задач.", "Стоит продолжать следить за нагрузкой."], "intern": ["Стало больше параллельных задач.", "Нужно внимательнее планировать загрузку."]},
        {"mentor": ["Качество работы осталось высоким, но из-за нагрузки часть сроков пришлось перенести.", "Нужно снизить нагрузку; других проблем нет."], "intern": ["Нагрузка была слишком высокой из-за нескольких проектов одновременно.", "Основная сложность — высокая нагрузка; по задачам и взаимодействию проблем нет."]},
        {"mentor": ["После снижения нагрузки снова работает в стабильном темпе.", "Сложностей, требующих внимания, нет."], "intern": ["Нагрузка вернулась к комфортному уровню.", "Существенных сложностей нет."]},
        {"mentor": ["Стабильно показывает высокий результат и проявляет инициативу.", "Можно развивать в сторону более сложных аналитических задач."], "intern": ["Сложностей за период не было.", "Хотелось бы продолжать развиваться в аналитических задачах."]},
      ],
      ai: [
        {"topic": "больше аналитических задач", "answer": {"s": {"status": "growth", "quotes": ["Хотелось бы больше аналитических задач."]}, "n": {"status": "growth", "quotes": ["Можно подключать к большему числу аналитических задач."]}}},
        {"topic": "текущие трудности", "answer": {"s": {"status": "none", "quotes": []}, "n": {"status": "none", "quotes": []}}},
        {"topic": "нагрузка и параллельные задачи", "answer": {"s": {"status": "issue", "quotes": ["Стало больше параллельных задач.", "Нужно внимательнее планировать загрузку."]}, "n": {"status": "issue", "quotes": ["Стоит продолжать следить за нагрузкой.", "Хорошо справляется с увеличившимся количеством задач."]}}},
        {"topic": "высокая нагрузка", "answer": {"s": {"status": "issue", "quotes": ["Нагрузка была слишком высокой из-за нескольких проектов одновременно.", "Основная сложность — высокая нагрузка"]}, "n": {"status": "issue", "quotes": ["Нужно снизить нагрузку", "из-за нагрузки часть сроков пришлось перенести."]}}},
        {"topic": "нагрузка", "answer": {"s": {"status": "better", "quotes": ["Нагрузка вернулась к комфортному уровню."]}, "n": {"status": "better", "quotes": ["После снижения нагрузки снова работает в стабильном темпе."]}}},
        {"topic": "более сложные аналитические задачи", "answer": {"s": {"status": "growth", "quotes": ["Хотелось бы продолжать развиваться в аналитических задачах."]}, "n": {"status": "growth", "quotes": ["Можно развивать в сторону более сложных аналитических задач."]}}},
      ],
    },
    {
      id: "СТ-005",
      name: "СТ-005",
      mentor: [[4, 4, 2, 3, 5, 3], [4, 4, 2, 3, 5, 3], [4, 4, 3, 3, 5, 3], [4, 4, 4, 4, 5, 4], [5, 5, 4, 5, 5, 5], [5, 5, 5, 5, 5, 5]],
      intern: [[2, 2, 4, 5, 5, 3, 3], [2, 2, 3, 5, 5, 3, 3], [3, 2, 3, 5, 5, 3, 3], [4, 4, 4, 5, 5, 4, 4], [4, 4, 4, 5, 5, 5, 5], [5, 5, 4, 5, 5, 5, 5]],
      texts: [
        {"mentor": ["Технически сильный и вовлеченный, но пока часто нуждается в помощи по организации работы.", "Нужно чаще обсуждать сложные вопросы и своевременно просить помощь."], "intern": ["Не всегда понятны приоритеты по задачам.", "Не хватает регулярной обратной связи от наставника."]},
        {"mentor": ["Качество работы хорошее, но часть задач задерживается из-за поздних уточнений.", "Нужна более регулярная связь с наставником."], "intern": ["Некоторые задачи задерживаются, потому что долго жду уточнений.", "Не хватает возможности быстро задать вопрос наставнику."]},
        {"mentor": ["Самостоятельность немного выросла, но по сложным задачам все еще нужна поддержка.", "Стоит ввести регулярные короткие встречи."], "intern": ["Задачи стали понятнее, но обратной связи все еще недостаточно.", "Хотелось бы регулярных коротких встреч с наставником."]},
        {"mentor": ["После регулярных встреч стал быстрее решать сложные вопросы и лучше соблюдать сроки.", "Ситуация улучшается, текущий формат стоит сохранить."], "intern": ["После регулярных встреч стало проще решать сложные вопросы.", "Иногда все еще приходится ждать ответа по сложным задачам."]},
        {"mentor": ["Хорошо справляется с задачами и своевременно сообщает о сложностях.", "Критичных сложностей нет."], "intern": ["Сложности возникают только по новым техническим задачам.", "Существенных препятствий нет."]},
        {"mentor": ["Показывает стабильный высокий результат и работает самостоятельно.", "Сложностей, требующих внимания, нет."], "intern": ["Серьезных сложностей нет.", "Ничего не мешает работать и развиваться."]},
      ],
      ai: [
        {"topic": "поддержка и связь с наставником", "answer": {"s": {"status": "issue", "quotes": ["Не хватает регулярной обратной связи от наставника."]}, "n": {"status": "issue", "quotes": ["Нужно чаще обсуждать сложные вопросы и своевременно просить помощь.", "пока часто нуждается в помощи по организации работы"]}}},
        {"topic": "поздние уточнения задач", "answer": {"s": {"status": "issue", "quotes": ["Некоторые задачи задерживаются, потому что долго жду уточнений.", "Не хватает возможности быстро задать вопрос наставнику."]}, "n": {"status": "issue", "quotes": ["Качество работы хорошее, но часть задач задерживается из-за поздних уточнений."]}}},
        {"topic": "поддержка по сложным вопросам", "answer": {"s": {"status": "issue", "quotes": ["Задачи стали понятнее, но обратной связи все еще недостаточно.", "Хотелось бы регулярных коротких встреч с наставником."]}, "n": {"status": "issue", "quotes": ["Самостоятельность немного выросла, но по сложным задачам все еще нужна поддержка.", "Стоит ввести регулярные короткие встречи."]}}},
        {"topic": "решение сложных вопросов и ожидание ответа", "answer": {"s": {"status": "mixed", "quotes": ["После регулярных встреч стало проще решать сложные вопросы.", "Иногда все еще приходится ждать ответа по сложным задачам."]}, "n": {"status": "better", "quotes": ["После регулярных встреч стал быстрее решать сложные вопросы и лучше соблюдать сроки.", "Ситуация улучшается, текущий формат стоит сохранить."]}}},
        {"topic": "трудности в новых технических задачах", "answer": {"s": {"status": "issue", "quotes": ["Сложности возникают только по новым техническим задачам."]}, "n": {"status": "none", "quotes": []}}},
        {"topic": "текущие трудности", "answer": {"s": {"status": "none", "quotes": []}, "n": {"status": "none", "quotes": []}}},
      ],
    },
  ];
  const get = (id) => root.getElementById(id);
  // Детерминированная синтетическая выборка, чтобы все увидели одинаковое демо.
  const demoDepartments = ['Технический блок', 'Коммерческий блок', 'Административный блок', 'HR-блок', 'IT'];
  const demoPopulation = Array.from({length: 50}, (_, index) => {
    const id = 'ДЕМО-' + String(index + 1).padStart(3, '0');
    const clamp = value => Math.max(1, Math.min(5, value));
    const mentor = Array.from({length: 6}, (_, month) => Array.from({length: 6}, (_, metric) =>
      clamp(2 + ((index * 7 + metric * 3 + Math.floor(index / 5)) % 4) +
        (month >= 3 && (index + metric) % 3 === 0 ? 1 : 0))
    ));
    const intern = Array.from({length: 6}, (_, month) => Array.from({length: 7}, (_, metric) =>
      clamp(2 + ((index * 3 + metric * 5 + Math.floor(index / 7)) % 4) +
        (month >= 3 && (index + metric) % 4 === 0 ? 1 : 0))
    ));
    return {id, name: id, mentor, intern, texts: Array.from({length: 6}, () => ({
      mentor: ['Демонстрационный профиль без текстового ответа.'],
      intern: ['Демонстрационный профиль без текстового ответа.']
    })), ai: Array(6).fill(null), department: demoDepartments[index % demoDepartments.length],
      startMonth: index % 5};
  });
  let dataset = 'organizers';
  const population = () => dataset === 'organizers' ? organizerPopulation : demoPopulation;
  const startMonth = person => dataset === 'organizers' ? demoStartMonths[person.id] : person.startMonth;
  let sortMetric = 'average';
  let sortDirection = 'desc';
  const rankingPageSize = 10;
  let rankingPage = 1;

  const calendarMonths = ['Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь'];
  const demoStartMonths = {'СТ-001': 0, 'СТ-002': 1, 'СТ-003': 2, 'СТ-004': 3, 'СТ-005': 4};
  let mode = 'calendar';
  let selectedMonth = 5;
  const drawer = get('drawer');
  const metricButtons = Array.from(root.querySelectorAll('[data-metric]'));
  let selectedMetric = 'all';
  let expandedInsight = null;
  let selectedHistoryMetric = 2;
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : mean([sorted[middle - 1], sorted[middle]]);
  }
  const scoreNumber = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const score = (value) => scoreNumber.format(value);

  let view;
  let returnFocus;
  let openedPersonId;

  function buildView() {
    const period = selectedMonth;
    const group = population().filter(person => mode === 'stage' || startMonth(person) <= period);
    const records = group.map(person => {
      const personalPeriod = mode === 'stage' ? period : Math.min(period - startMonth(person), 5);
      return {...person, personalPeriod, scores: person.mentor[personalPeriod],
        average: mean(person.mentor[personalPeriod])};
    }).sort((a, b) => a.average - b.average || a.id.localeCompare(b.id));
    return {period, group, records, baseline: median(records.map(record => record.average))};
  }


  const trackedMetrics = [
    {label: 'Понятность задач', color: 'var(--analytics-clarity)', dash: ''},
    {label: 'Поддержка наставника', color: 'var(--analytics-support)', dash: '8 4'},
    {label: 'Комфортность нагрузки', color: 'var(--analytics-workload)', dash: '2 4'}
  ];

  function plotTrend() {
    const {period, group} = view;
    const x = month => 56 + month * 104;
    const y = value => 20 + (5 - value) * 57;
    const axes = [1, 2, 3, 4, 5].map(value =>
      '<line x1="56" x2="576" y1="' + y(value) + '" y2="' + y(value) +
      '" stroke="var(--border)"/><text x="35" y="' + (y(value) + 5) +
      '" text-anchor="end">' + value + '</text>').join('');
    const paths = trackedMetrics.map((metric, index) => {
      if (selectedMetric !== 'all' && Number(selectedMetric) !== index) return '';
      const values = Array.from({length: 6}, (_, month) => {
        const responses = month > period ? [] : population().filter(person => mode === 'stage' || (startMonth(person) <= month && month - startMonth(person) < 6))
          .map(person => person.intern[mode === 'stage' ? month : month - startMonth(person)][index]);
        return {value: responses.length ? mean(responses) : null, count: responses.length};
      });
      const path = values.map((entry, month) => entry.value === null ? '' :
        (month === 0 || values[month - 1].value === null ? 'M' : 'L') + x(month) + ' ' + y(entry.value)).join(' ');
      const marks = values.map((entry, month) => entry.value === null ? '' : '<circle cx="' + x(month) + '" cy="' + y(entry.value) +
        '" r="' + (month === period ? 6 : 4) + '" fill="' + metric.color + '" stroke="var(--card)" stroke-width="2"><title>' +
        metric.label + ', ' + (mode === 'calendar' ? calendarMonths[month] : 'месяц ' + (month + 1)) + ': ' + score(entry.value) + ' из 5, ответов ' + entry.count + '</title></circle>').join('');
      return '<path d="' + path + '" fill="none" stroke="' + metric.color + '" stroke-width="3" stroke-dasharray="' +
        metric.dash + '" stroke-linejoin="round" stroke-linecap="round"/>' + marks;
    }).join('');
    const countLabels = Array.from({length: 6}, (_, month) => {
      const count = month > period ? 0 : population().filter(person => mode === 'stage' ||
        (startMonth(person) <= month && month - startMonth(person) < 6)).length;
      return '<text x="' + x(month) + '" y="257" text-anchor="middle" class="count-label" font-size="11">n=' + count + '</text>';
    }).join('');
    const labels = Array.from({length: 6}, (_, month) => '<text x="' + x(month) + '" y="275" text-anchor="middle"' +
      (month === period ? ' font-weight="700" fill="var(--foreground)"' : '') + '>' + (mode === 'calendar' ? calendarMonths[month].slice(0,3) : month + 1) + '</text>').join('');
    const description = trackedMetrics.map((metric, index) => metric.label + ': ' +
      score(mean(view.records.map(person => person.intern[person.personalPeriod][index])))).join(', ');
    get('primary-chart').innerHTML = '<svg viewBox="0 0 605 285" role="img" aria-label="' + (mode === 'calendar' ? calendarMonths[period] : 'Месяц ' + (period + 1)) +
      '. Средние оценки стажёров: ' + description + ' из пяти.">' +
      '<rect x="' + (x(period) - 15) + '" y="10" width="30" height="240" rx="6" fill="var(--accent)"/>' +
      '<g fill="var(--muted-foreground)" font-size="14">' + axes + labels + countLabels + '</g>' + paths + '</svg>';
    get('coverage').textContent = (mode === 'calendar' ? calendarMonths[period] + ' 2026' : 'Месяц ' + (period + 1)) + ' · Ответили стажёры ' + group.length + '/' + group.length +
      ' · Наставники ' + group.length + '/' + group.length + ' · Полные пары ' + group.length + '/' + group.length;
  }

  function plotInsights() {
    const {period, records} = view;
    get('insight-period').textContent = (mode === 'calendar' ? calendarMonths[period] + ' 2026' : 'Месяц ' + (period + 1)) + ' · оценки 1–2 требуют проверки';
    const numeric = trackedMetrics.map((metric, index) => {
      const people = records.filter(person => person.intern[person.personalPeriod][index] <= 2);
      const expanded = expandedInsight === String(index);
      return '<button class="insight-toggle" type="button" data-insight="' + index + '" aria-expanded="' + expanded +
        '"><span>' + metric.label + '</span><strong>' + people.length + ' из ' + records.length + '</strong></button>' +
        (expanded ? '<div class="insight-list">' + (people.length ? people.map(person =>
          '<button class="insight-person" type="button" data-person="' + person.id + '">' + person.id +
          ' · ' + person.intern[person.personalPeriod][index] + ' из 5</button>').join('') :
          '<span class="insight-empty">Низких оценок в этом месяце нет.</span>') + '</div>' : '');
    }).join('');
    const textSignals = records.filter(person => issueAt(person, person.personalPeriod).kind === 'issue');
    const signals = textSignals.length ? textSignals.map(person => '<button class="insight-person" type="button" data-person="' +
      person.id + '">' + person.id + ' · ' + escapeText(issueAt(person, person.personalPeriod).topic) + '</button>').join('') :
      '<span class="insight-empty">' + (dataset === 'demo' ? 'ИИ-разбор синтетической выборки не проводился.' : 'В сохранённых разборах трудности не выделены.') + '</span>';
    get('insights').innerHTML = '<section class="insight-section"><h4>Низкие оценки стажёров</h4>' + numeric +
      '</section><section class="insight-section"><h4>Темы в ответах · Haiku</h4><div class="insight-list">' +
      signals + '</div></section>';
  }


  let expandedDistribution = null;
  let showAllComparisons = false;

  function plotAdditionalCharts() {
    const {records} = view;
    const rows = trackedMetrics.map((metric, index) => {
      const segments = [1, 2, 3, 4, 5].map(value => {
        const people = records.filter(person => person.intern[person.personalPeriod][index] === value);
        if (!people.length) return '';
        const key = index + ':' + value;
        return '<button type="button" data-distribution="' + key + '" data-value="' + value +
          '" aria-expanded="' + (expandedDistribution === key) + '" style="flex:' + people.length +
          '" aria-label="' + metric.label + ', оценка ' + value + ', стажёров ' + people.length +
          '"> ' + value + ' · ' + people.length + '</button>';
      }).join('');
      const [selectedIndex, selectedValue] = (expandedDistribution ?? '').split(':').map(Number);
      const selected = expandedDistribution !== null && selectedIndex === index
        ? records.filter(person => person.intern[person.personalPeriod][index] === selectedValue) : [];
      return '<div class="distribution-row"><h4>' + metric.label + '</h4><div class="distribution-bars">' +
        segments + '</div><div class="distribution-values">' + selected.map(person =>
        '<button type="button" data-person="' + person.id + '">' + person.id + '</button>').join('') + '</div></div>';
    }).join('');
    get('score-distribution').innerHTML = '<div class="distribution-legend"><span><i class="low"></i> 1–2</span>' +
      '<span><i></i> 3</span><span><i class="high"></i> 4–5</span><span>Оценка · число стажёров</span></div>' + rows;
    const position = value => (value - 1) * 25;
    const sortedRecords = records.slice().sort((a, b) => a.id.localeCompare(b.id));
    const visibleRecords = showAllComparisons ? sortedRecords : sortedRecords.slice(0, 8);
    const comparison = visibleRecords.map(person => {
      const intern = person.intern[person.personalPeriod][0];
      const mentor = person.mentor[person.personalPeriod][0];
      const left = Math.min(position(intern), position(mentor));
      const width = Math.abs(position(intern) - position(mentor));
      return '<button class="comparison-row" type="button" data-person="' + person.id +
        '" aria-label="' + person.id + ': стажёр ' + intern + ', наставник ' + mentor + ' из 5">' +
        '<strong>' + person.id + '</strong><span class="comparison-axis"><i class="comparison-connector" style="left:' + left +
        '%;width:' + width + '%"></i><i class="comparison-point" style="left:' + position(intern) +
        '%"></i><i class="comparison-point mentor" style="left:' + position(mentor) + '%"></i></span>' +
        '<span class="comparison-values">' + intern + ' / ' + mentor + '</span></button>';
    }).join('');
    get('comparison-chart').innerHTML = '<div class="comparison-legend"><span><i></i> Стажёр</span>' +
      '<span><i class="mentor"></i> Наставник</span></div>' + comparison +
      '<div class="comparison-ticks" aria-hidden="true"><span></span><div><span>1</span><span>2</span>' +
      '<span>3</span><span>4</span><span>5</span></div><span></span></div>' +
      (records.length > 8 ? '<button class="comparison-more" type="button" data-show-comparisons>' +
        (showAllComparisons ? 'Свернуть' : 'Показать все · ' + records.length) + '</button>' : '');
  }

  function caseHistory(record, period) {
    const history = record.mentor.slice(0, period + 1).map(values => values[selectedHistoryMetric]);
    const x = (index) => 85 + index * 63;
    const y = (value) => 15 + (5 - value) * 21;
    const line = history.map((value, index) => (index ? 'L' : 'M') + x(index) + ' ' + y(value)).join(' ');
    const labels = history.map((value, index) => '<circle cx="' + x(index) + '" cy="' + y(value) + '" r="' +
      (index === period ? 5 : 3.5) + '" fill="' + (index === period ? 'var(--tone-danger)' : 'var(--analytics-clarity)') + '"/>' +
      '<text x="' + x(index) + '" y="' + (y(value) - 8) + '" text-anchor="middle">' + score(value) + '</text>' +
      '<text x="' + x(index) + '" y="118" text-anchor="middle">' + (index + 1) + '</text>').join('');
    return '<section class="drawer-block case-history"><h4>Динамика оценки наставника</h4>' +
      '<label class="dialog-field-label">Критерий<select class="case-select" id="history-metric">' + metrics.map((metric, index) =>
      '<option value="' + index + '"' + (index === selectedHistoryMetric ? ' selected' : '') + '>' + metric + '</option>').join('') + '</select></label>' +
      '<svg viewBox="0 0 440 127" role="img" aria-label="' + history.map((value, index) => 'Месяц ' + (index + 1) + ', ' + score(value)).join('; ') +
      '"><path d="M85 99H400 M85 57H400 M85 15H400" fill="none" stroke="var(--border)"/>' +
      '<g fill="var(--muted-foreground)" font-size="12"><text x="68" y="103" text-anchor="end">1</text><text x="68" y="61" text-anchor="end">3</text>' +
      '<text x="68" y="19" text-anchor="end">5</text><text x="68" y="118" text-anchor="end">Месяц</text></g>' +
      '<path d="' + line + '" fill="none" stroke="var(--analytics-clarity)" stroke-width="2"/><g fill="var(--muted-foreground)" font-size="12">' + labels + '</g></svg></section>';
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  const roleNames = {s: 'Стажёр', n: 'Наставник'};
  const statusLabels = {
    issue: 'Отмечена трудность', better: 'Отмечено улучшение',
    mixed: 'Есть улучшение и трудность', growth: 'Пожелание или предложение',
    none: 'Тема не отмечена'
  };
  const topicGroups = {
    'СТ-003': ['ясность задач', 'ясность задач', 'ясность задач', 'ясность задач', 'ясность задач'],
    'СТ-004': [null, null, 'нагрузка', 'нагрузка', 'нагрузка'],
    'СТ-005': ['связь с наставником', 'связь с наставником', 'связь с наставником', 'связь с наставником']
  };
  const conversationQuestions = {
    'ясность задач': 'Как сейчас уточняете ожидаемый результат, когда появляется новая задача?',
    'нагрузка': 'Какие задачи сейчас идут одновременно и как вы решаете, что можно перенести?',
    'высокая нагрузка': 'Какие задачи сейчас идут одновременно и как вы решаете, что можно перенести?',
    'связь с наставником': 'Как сейчас договорено получать ответ, если без уточнения задача останавливается?',
    'участие во встречах команды': 'На какие встречи команды было бы полезно приглашать стажёра чаще?'
  };
  const reviewedLabels = { 'СТ-002:1': {s: 'growth'} };
  const sessionNotes = new Map();

  function issueAt(record, period) {
    const result = record.ai[period];
    if (!result) return {topic: '', group: '', kind: 'unavailable', roles: []};
    const validRoles = Object.entries(result.answer).map(([role, item]) => {
      const source = record.texts[period][role === 's' ? 'intern' : 'mentor'];
      const quotes = item.quotes.filter(quote => source.some(text => text.includes(quote)));
      const status = quotes.length ? reviewedLabels[record.id + ':' + period]?.[role] ?? item.status : 'none';
      return {role, status, quotes};
    });
    const statuses = validRoles.map(item => item.status);
    const kind = statuses.some(status => status === 'issue' || status === 'mixed') ? 'issue'
      : statuses.includes('growth') ? 'growth' : statuses.includes('better') ? 'better' : 'none';
    const topic = result.topic;
    const group = topicGroups[record.id]?.[period] ?? topic;
    return {topic, group, kind, roles: validRoles};
  }

  function reviewKey(record, period, signal) {
    return 'mgts/dashboard/review/' + JSON.stringify([record.id, period, signal.group]);
  }

  function readReview(record, period, signal) {
    const key = reviewKey(record, period, signal);
    if (sessionNotes.has(key)) return sessionNotes.get(key);
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function previousDiscussion(record, period, signal) {
    if (signal.kind !== 'issue') return null;
    for (let month = period - 1; month >= 0; month--) {
      const earlier = issueAt(record, month);
      if (earlier.kind !== 'issue' || earlier.group !== signal.group) continue;
      const note = readReview(record, month, earlier);
      if (note) return {month, note};
    }
    return null;
  }


  const departments = {
    'СТ-001': 'Технический блок', 'СТ-002': 'Коммерческий блок',
    'СТ-003': 'Административный блок', 'СТ-004': 'HR-блок', 'СТ-005': 'IT'
  };
  const groupedTopics = {
    'понимание задач после встреч': 'Понятность задач',
    'нагрузка': 'Нагрузка',
    'планирование времени': 'Планирование задач',
    'планирование работы': 'Планирование задач',
    'ясность постановки задач': 'Понятность задач',
    'повторные уточнения требований': 'Понятность задач',
    'необходимость уточнять задачи': 'Понятность задач',
    'поддержка и связь с наставником': 'Поддержка и обратная связь',
    'поздние уточнения задач': 'Поддержка и обратная связь',
    'поддержка по сложным вопросам': 'Поддержка и обратная связь',
    'поддержка по сложным задачам': 'Поддержка и обратная связь',
    'решение сложных вопросов и ожидание ответа': 'Поддержка и обратная связь',
    'высокая нагрузка': 'Нагрузка',
    'нагрузка и параллельные задачи': 'Нагрузка'
  };
  let expandedTopic = null;
  let expandedDepartment = null;

  function plotOverviewCharts() {
    const {records} = view;
    const topics = new Map();
    for (const record of records) {
      const signal = issueAt(record, record.personalPeriod);
      if (!['issue', 'growth', 'better'].includes(signal.kind)) continue;
      const label = groupedTopics[signal.topic] ?? signal.topic;
      if (!topics.has(label)) topics.set(label, {positive: [], negative: []});
      const statuses = signal.roles.map(role => role.status);
      if (statuses.some(status => status === 'issue' || status === 'mixed')) topics.get(label).negative.push(record);
      if (statuses.some(status => ['better', 'growth', 'mixed'].includes(status))) topics.get(label).positive.push(record);
    }
    const orderedTopics = Array.from(topics).sort((a, b) =>
      (b[1].positive.length + b[1].negative.length) - (a[1].positive.length + a[1].negative.length) ||
      a[0].localeCompare(b[0], 'ru'));
    get('themes-chart').innerHTML = orderedTopics.length
      ? '<div class="topic-legend"><span><i></i>Трудность</span><span><i class="positive"></i>Улучшение или развитие</span><span>Числа — трудности / положительные, возможны оба</span></div><div class="topic-chart">' + orderedTopics.map(([label, groups], index) => {
        const expanded = expandedTopic === index;
        const people = Array.from(new Set([...groups.negative, ...groups.positive]));
        return '<div><button class="topic-row" type="button" data-topic-index="' + index +
          '" aria-expanded="' + expanded + '"><span>' + escapeText(label) +
          '</span><span class="topic-bar"><i class="topic-negative" style="width:' +
          (groups.negative.length / records.length * 50) + '%"></i><i class="topic-positive" style="width:' +
          (groups.positive.length / records.length * 50) + '%"></i></span><strong>' +
          groups.negative.length + ' / ' + groups.positive.length + '</strong></button>' +
          (expanded ? '<div class="topic-people">' + people.map(person =>
            '<button type="button" data-person="' + person.id + '">' + person.id +
            (groups.negative.includes(person) && groups.positive.includes(person) ? ' · обе оценки' : groups.negative.includes(person) ? ' · трудность' : ' · положительное') + '</button>').join('') + '</div>' : '') + '</div>';
      }).join('') + '</div>'
      : '<p class="insight-empty">' + (dataset === 'demo' ? 'В синтетической выборке нет ИИ-разбора комментариев.' :
        'В сохранённых разборах за этот период нет выделенных тем.') + '</p>';

    const byDepartment = new Map();
    for (const record of records) {
      const name = record.department ?? departments[record.id];
      if (!byDepartment.has(name)) byDepartment.set(name, []);
      byDepartment.get(name).push(record);
    }
    const groups = Array.from(byDepartment).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
    get('departments-chart').innerHTML = '<div class="department-chart">' + groups.map(([name, people], index) => {
      const average = mean(people.map(person => person.intern[person.personalPeriod][1]));
      const expanded = expandedDepartment === index;
      return '<div><button class="department-row" type="button" data-department-index="' + index +
        '" aria-expanded="' + expanded + '"><span>' + escapeText(name) +
        '</span><span class="department-bar"><i style="width:' + (average / 5 * 100) +
        '%"></i></span><strong>' + score(average) + ' / 5 · ' + people.length + ' отв.</strong></button>' +
        (expanded ? '<div class="department-people">' + people.map(person =>
          '<button type="button" data-person="' + person.id + '">' + person.id + ' · ' +
          person.intern[person.personalPeriod][1] + ' / 5</button>').join('') + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function plotQueue() {
    const {records} = view;
    const groups = {issue: [], growth: [], better: [], discussed: []};
    for (const record of records) {
      const signal = issueAt(record, record.personalPeriod);
      if (signal.kind === 'none' || signal.kind === 'unavailable') continue;
      const reviewed = readReview(record, record.personalPeriod, signal);
      const repeated = !reviewed && previousDiscussion(record, record.personalPeriod, signal);
      groups[reviewed ? 'discussed' : signal.kind].push(
        '<button type="button" class="queue-button" data-person="' + record.id + '"><strong>' +
        escapeText(record.name) + '</strong><span class="queue-score">' + score(record.average) +
        ' / 5</span><small>' + escapeText(signal.topic) + '</small>' +
        (repeated ? '<span class="queue-status queue-meta-issue">Снова упомянуто после обсуждения</span>' : '') + '</button>'
      );
    }
    const labels = {issue: 'К обсуждению', growth: 'Возможности развития', better: 'Улучшения', discussed: 'Обсуждено'};
    get('queue-meta').textContent = groups.issue.length + ' к обсуждению · ' + groups.discussed.length + ' обсуждено';
    get('queue-list').innerHTML = Object.entries(groups).filter(([, items]) => items.length).map(([kind, items]) =>
      '<section class="queue-group" data-kind="' + kind + '"><h4>' + labels[kind] + '</h4>' +
      '<div class="queue-list">' + items.join('') + '</div></section>'
    ).join('') || '<p class="empty">' + (dataset === 'demo' ? 'Для синтетической выборки ИИ-разбор не проводился.' : 'В сохранённых разборах за этот месяц нет тем для просмотра.') + '</p>';
  }


  function percentileRank(value, values) {
    const lower = values.filter(item => item < value).length;
    const equal = values.filter(item => item === value).length;
    return 100 * (lower + equal / 2) / values.length;
  }

  function rankBand(percentile) {
    if (percentile >= 90) return {style: 'rank-5', label: '90–100'};
    if (percentile >= 70) return {style: 'rank-4', label: '70–90'};
    if (percentile >= 50) return {style: 'rank-3', label: '50–70'};
    if (percentile >= 20) return {style: 'rank-2', label: '20–50'};
    return {style: 'rank-1', label: '0–20'};
  }

  function plotRanking() {
    const records = view.records;
    const valueFor = record => sortMetric === 'average' ? record.average : record.scores[Number(sortMetric)];
    const values = records.map(valueFor);
    const sorted = records.slice().sort((a, b) => {
      const diff = valueFor(a) - valueFor(b);
      return (sortDirection === 'asc' ? diff : -diff) || a.id.localeCompare(b.id, 'ru');
    });
    const pageCount = Math.max(1, Math.ceil(sorted.length / rankingPageSize));
    rankingPage = Math.max(1, Math.min(rankingPage, pageCount));
    const pageStart = (rankingPage - 1) * rankingPageSize;
    const pageEnd = Math.min(pageStart + rankingPageSize, sorted.length);
    get('ranking-pagination').hidden = pageCount === 1;
    get('ranking-page-status').textContent = `${pageStart + 1}–${pageEnd} из ${sorted.length} · Страница ${rankingPage} из ${pageCount}`;
    get('ranking-previous').disabled = rankingPage === 1;
    get('ranking-next').disabled = rankingPage === pageCount;
    const columns = [{key: 'average', label: 'Среднее'}, ...metrics.map((label, index) => ({key: String(index), label}))];
    get('ranking-summary').textContent = records.length + ' стажёров · оценки наставников за выбранный период';
    get('ranking-explanation').textContent = 'Цвет и перцентиль рассчитаны относительно текущей выборки по столбцу «' +
      columns.find(column => column.key === sortMetric).label + '». Равные оценки имеют одинаковый перцентиль.';
    get('ranking-head').innerHTML = '<tr><th scope="col">Стажёр</th><th scope="col">Направление</th>' +
      '<th scope="col">Этап</th>' + columns.map(column => '<th scope="col"' +
      (column.key === sortMetric ? ' aria-sort="' + (sortDirection === 'asc' ? 'ascending' : 'descending') + '"' : '') +
      '><button type="button" data-sort="' + column.key + '">' + column.label +
      (column.key === sortMetric ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕') +
      '</button></th>').join('') + '<th scope="col">Перцентиль</th></tr>';
    get('ranking-body').innerHTML = sorted.slice(pageStart, pageEnd).map(record => {
      const percentile = percentileRank(valueFor(record), values);
      const band = rankBand(percentile);
      return '<tr class="' + band.style + '"><td><button type="button" data-person="' + record.id + '">' + record.id +
        '</button></td><td>' + escapeText(record.department ?? departments[record.id]) + '</td><td>Месяц ' +
        (record.personalPeriod + 1) + '</td><td>' + score(record.average) + '</td>' +
        record.scores.map(value => '<td>' + value + '</td>').join('') +
        '<td><span class="rank-badge ' + band.style + '">' + Math.round(percentile) +
        ' · ' + band.label + '</span></td></tr>';
    }).join('');
  }

  function render() {
    view = buildView();
    for (const button of metricButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.metric === selectedMetric));
    }
    root.querySelectorAll('[data-dataset]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.dataset === dataset)));
    get('population-caption').textContent = dataset === 'demo'
      ? '50 вымышленных стажёров · данные для демонстрации'
      : 'Историческая выборка организаторов · 5 стажёров';
    get('dataset-note').textContent = dataset === 'demo'
      ? 'Все профили, оценки и даты в этой выборке синтетические. ИИ-разбор отсутствует.'
      : 'Оценки и ответы взяты из материалов организаторов. Даты начала и отправки анкет демонстрационные.';
    root.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === mode)));
    const labels = mode === 'calendar' ? calendarMonths : ['Месяц 1','Месяц 2','Месяц 3','Месяц 4','Месяц 5','Месяц 6'];
    get('period-navigation').className = 'stages calendar-periods';
    get('period-navigation').innerHTML = labels.map((label, index) =>
      '<button type="button" data-month="' + index + '" aria-pressed="' + (index === selectedMonth) + '">' + label + '</button>'
    ).join('');
    get('chart-description').textContent = mode === 'calendar'
      ? 'Оценки стажёров по календарному месяцу ответа'
      : 'Оценки стажёров на одинаковом этапе стажировки';
    get('chart-axis').textContent = mode === 'calendar' ? 'Календарный месяц · 2026' : 'Месяц стажировки';
    plotTrend();
    plotInsights();
    plotAdditionalCharts();
    plotOverviewCharts();
    plotQueue();
    plotRanking();
  }

  function renderCase(personId, trigger, savedMessage = '') {
    const { records, baseline } = view;
    const record = records.find((candidate) => candidate.id === personId);
    if (!record) return;
    const period = record.personalPeriod;
    returnFocus = trigger;
    openedPersonId = record.id;
    get('case-meta').textContent = record.id + ' / Месяц ' + (period + 1) + (mode === 'calendar' ? ' / начало ' + calendarMonths[startMonth(record)].toLowerCase() + ' 2026 / ответ ' + calendarMonths[selectedMonth].toLowerCase() + ' 2026' : '');
    get('case-title').textContent = record.name;

    const profile = metrics.map((label, index) => {
      const value = record.scores[index];
      const groupMedian = median(records.map((entry) => entry.scores[index]));
      return '<div class="metric' + (groupMedian - value >= 1 ? ' is-signal' : '') + '"><span>' + label +
        '</span><div class="metric-track" aria-label="Медиана ' + score(groupMedian) + ' из 5" role="img">' +
        '<div class="metric-bar" style="width:' + value * 20 + '%"></div><i class="metric-reference" style="left:' + groupMedian * 20 +
        '%"></i></div><strong>' + value + '</strong></div>';
    }).join('');


    const signal = issueAt(record, record.personalPeriod);
    const previous = previousDiscussion(record, record.personalPeriod, signal);
    const review = readReview(record, record.personalPeriod, signal);
    const question = conversationQuestions[signal.group] ?? (signal.kind === 'growth'
      ? 'Какую задачу или возможность можно обсудить на следующей встрече?'
      : 'В какой ситуации это проявилось и что стоит попробовать к следующей встрече?');
    const preparation = signal.kind === 'issue' || signal.kind === 'growth'
      ? '<p class="ai-action"><strong>Вопрос для разговора</strong><br>' + escapeText(question) + '</p>'
      : '';
    const aiPanel = signal.kind !== 'none' && signal.kind !== 'unavailable'
      ? '<section class="drawer-block ai"><div class="ai-head"><h4>Разбор Haiku</h4><span class="meta">Сохранённый ответ модели</span></div>' +
        '<p class="ai-lead">' + escapeText(signal.topic.charAt(0).toUpperCase() + signal.topic.slice(1)) + '</p><div class="ai-quotes">' +
        signal.roles.map(({role, status, quotes}) =>
          '<div><p class="ai-body"><strong>' + roleNames[role] + '</strong><br>' + statusLabels[status] + '</p>' +
          quotes.map(quote => '<blockquote>«' + escapeText(quote) + '»</blockquote>').join('') + '</div>'
        ).join('') + '</div>' +
        (reviewedLabels[record.id + ':' + period] ? '<p class="meta">Метка уточнена по анкете стажёра.</p>' : '') +
        preparation + '</section>'
      : '<section class="drawer-block"><h4>Разбор Haiku</h4><p class="meta">' + (signal.kind === 'unavailable' ? 'Для синтетических анкет ИИ-разбор не проводился.' : 'По текущим ответам активной темы нет.') + '</p></section>';
    const followup = signal.kind !== 'none' && signal.kind !== 'unavailable'
      ? '<section class="drawer-block followup"><h4>' + (review ? 'Обсуждено' : 'Действия HR') + '</h4>' +
        (previous ? '<p class="review-note"><strong>Тему уже обсуждали в месяце ' + (previous.month + 1) +
          '</strong><br>Что договорились сделать — ' + escapeText(previous.note) + '</p>' : '') +
        (review ? '<p class="review-note">' + escapeText(review) + '</p>' : '') +
        '<details><summary>' + (review ? 'Изменить запись' : 'Обсудить') + '</summary>' +
        '<form id="discussion-form" data-person="' + record.id + '"><label>Следующий шаг' +
        '<textarea name="nextStep" required maxlength="400">' + escapeText(review ?? '') +
        '</textarea></label><button type="submit">' + (review ? 'Сохранить запись' : 'Отметить как обсуждено') +
        '</button></form></details><p id="save-status" class="save-status" tabindex="-1" role="status">' +
        escapeText(savedMessage) + '</p></section>'
      : '';
    const evidence = '<section class="drawer-block evidence"><h4>Исходные ответы за месяц</h4>' +
      [['intern', 'стажёра'], ['mentor', 'наставника']].map(([role, label]) =>
        '<details><summary>Анкета ' + label + '</summary>' +
        record.texts[period][role].map(text => '<blockquote>«' + escapeText(text) + '»</blockquote>').join('') +
        '</details>'
      ).join('') + '</section>';

    get('case-content').innerHTML = '<div class="numbers"><span>Оценка наставника <strong>' + score(record.average) +
      '</strong></span><span>Медиана выборки <strong>' + score(baseline) + '</strong></span>' +
      '</div>' + aiPanel + followup +
      '<section class="drawer-block"><h4>Что оценил наставник</h4><p class="metric-key">Черта показывает медиану группы по критерию</p>' +
      '<div class="metric-list">' + profile + '</div></section>' + evidence + caseHistory(record, period);
    if (!drawer.open) {
      drawer.scrollTop = 0;
      drawer.showModal();
    }
  }

  drawer.addEventListener('submit', event => {
    const form = event.target;
    if (form.id !== 'discussion-form') return;
    event.preventDefault();
    const input = form.elements.namedItem('nextStep');
    const note = input.value.trim();
    if (!note) {
      input.setCustomValidity('Запишите следующий шаг.');
      input.reportValidity();
      return;
    }
    const record = view.records.find(item => item.id === form.dataset.person);
    if (!record) return;
    const key = reviewKey(record, record.personalPeriod, issueAt(record, record.personalPeriod));
    let message = 'Следующий шаг сохранён в этом браузере.';
    try {
      localStorage.setItem(key, note);
      sessionNotes.delete(key);
    } catch {
      sessionNotes.set(key, note);
      message = 'Запись сохранена до закрытия страницы.';
    }
    plotQueue();
    const trigger = returnFocus?.isConnected ? returnFocus
      : get('queue-list').querySelector('[data-person="' + record.id + '"]');
    renderCase(record.id, trigger, message);
    get('save-status').focus();
  });

  drawer.addEventListener('change', event => {
    if (event.target.id === 'history-metric') {
      selectedHistoryMetric = Number(event.target.value);
      renderCase(openedPersonId, returnFocus);
      get('history-metric').focus();
    }
  });

  drawer.addEventListener('input', event => {
    if (event.target.name === 'nextStep') event.target.setCustomValidity('');
  });

  root.querySelector('.page').addEventListener('click', (event) => {
    const point = event.target.closest('[data-person]');
    if (point) { selectedHistoryMetric = 2; renderCase(point.dataset.person, point); }
    const moreComparisons = event.target.closest('[data-show-comparisons]');
    if (moreComparisons) {
      showAllComparisons = !showAllComparisons;
      plotAdditionalCharts();
      root.querySelector('[data-show-comparisons]').focus();
    }
    const segment = event.target.closest('[data-distribution]');
    if (segment) {
      expandedDistribution = expandedDistribution === segment.dataset.distribution ? null : segment.dataset.distribution;
      plotAdditionalCharts();
      root.querySelector('[data-distribution="' + segment.dataset.distribution + '"]').focus();
    }
    const topic = event.target.closest('[data-topic-index]');
    if (topic) {
      const index = Number(topic.dataset.topicIndex);
      expandedTopic = expandedTopic === index ? null : index;
      plotOverviewCharts();
      root.querySelector('[data-topic-index="' + index + '"]').focus();
    }
    const department = event.target.closest('[data-department-index]');
    if (department) {
      const index = Number(department.dataset.departmentIndex);
      expandedDepartment = expandedDepartment === index ? null : index;
      plotOverviewCharts();
      root.querySelector('[data-department-index="' + index + '"]').focus();
    }
    const sort = event.target.closest('[data-sort]');
    if (sort) {
      if (sortMetric === sort.dataset.sort) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      else { sortMetric = sort.dataset.sort; sortDirection = 'desc'; }
      rankingPage = 1;
      plotRanking();
      root.querySelector('[data-sort="' + sortMetric + '"]').focus();
    }
    const metric = event.target.closest('[data-metric]');
    if (metric) { selectedMetric = metric.dataset.metric; render(); }
    const insight = event.target.closest('[data-insight]');
    if (insight) {
      expandedInsight = expandedInsight === insight.dataset.insight ? null : insight.dataset.insight;
      plotInsights();
      root.querySelector('[data-insight="' + insight.dataset.insight + '"]').focus();
    }
  });
  get('ranking-pagination').addEventListener('click', event => {
    const button = event.target.closest('[data-ranking-step]');
    if (!button || button.disabled) return;
    const step = Number(button.dataset.rankingStep);
    rankingPage += step;
    plotRanking();
    if (button.disabled) get(step > 0 ? 'ranking-previous' : 'ranking-next').focus();
  });
  get('period-navigation').addEventListener('click', event => {
    const button = event.target.closest('[data-month]');
    if (!button) return;
    selectedMonth = Number(button.dataset.month);
    rankingPage = 1;
    expandedInsight = null;
    expandedDistribution = null;
    expandedTopic = null;
    expandedDepartment = null;
    render();
    get('period-navigation').querySelector('[data-month="' + selectedMonth + '"]').focus();
  });
  root.querySelectorAll('[data-dataset]').forEach(button => button.addEventListener('click', () => {
    dataset = button.dataset.dataset;
    rankingPage = 1;
    showAllComparisons = false;
    expandedInsight = null;
    expandedDistribution = null;
    expandedTopic = null;
    expandedDepartment = null;
    render();
  }));
  root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.view;
    selectedMonth = mode === 'calendar' ? 5 : 3;
    rankingPage = 1;
    expandedInsight = null;
    expandedDistribution = null;
    expandedTopic = null;
    expandedDepartment = null;
    render();
  }));
  get('close-case').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', (event) => {
    if (event.target !== drawer) return;
    const bounds = drawer.getBoundingClientRect();
    if (event.clientX < bounds.left) drawer.close();
  });
  drawer.addEventListener('close', () => returnFocus?.focus());
  render();
}
