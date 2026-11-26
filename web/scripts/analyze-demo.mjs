import { once } from "node:events";
import { rename, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { demoScenarios } from "../src/app/dashboard/demo-scenarios.mjs";

const model = "anthropic/claude-haiku-4.5";
const statuses = ["issue", "growth", "better", "mixed", "none"];
const topics = ["Понятность задач", "Поддержка и обратная связь", "Нагрузка", "Самостоятельность", "Работа с командой", "Нет активной темы"];
const roleSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: statuses },
    quotes: { type: "array", items: { type: "string" } },
  },
  required: ["status", "quotes"],
  additionalProperties: false,
};
const schema = {
  type: "object",
  properties: {
    scenarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: Object.keys(demoScenarios) },
          topic: { type: "string", enum: topics },
          intern: roleSchema,
          mentor: roleSchema,
        },
        required: ["id", "topic", "intern", "mentor"],
        additionalProperties: false,
      },
    },
  },
  required: ["scenarios"],
  additionalProperties: false,
};

async function readKey() {
  if (!process.argv.includes("--stdin")) return process.env.OPENROUTER_API_KEY?.trim();
  console.log("Введите ключ OpenRouter.");
  const input = createInterface({ input: process.stdin });
  try {
    const [key] = await once(input, "line");
    return key.trim();
  } finally {
    input.close();
  }
}

function validateRole(role, source, scenario) {
  if (!statuses.includes(role?.status) || !Array.isArray(role.quotes) || role.quotes.length > 2) {
    throw new Error(`Неверная оценка роли в сценарии ${scenario}`);
  }
  if ((role.status === "none") !== (role.quotes.length === 0) || role.quotes.some((quote) =>
    typeof quote !== "string" || !quote.trim() || !source.some((text) => text.includes(quote)))) {
    throw new Error(`Цитата не подтверждена в сценарии ${scenario}`);
  }
  return { status: role.status, quotes: [...new Set(role.quotes)] };
}

async function analyze() {
  const apiKey = await readKey();
  if (!apiKey) throw new Error("Задайте OPENROUTER_API_KEY для разбора синтетики.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(75000),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 3700,
      provider: { require_parameters: true },
      response_format: { type: "json_schema", json_schema: { name: "pulse_demo_analysis", strict: true, schema } },
      messages: [
        { role: "system", content: "Разбирай пары вымышленных отзывов о стажировке. По каждой паре выбери одну общую тему и отдельно оцени тексты стажёра и наставника. issue означает конкретную проблему, growth означает предложение развиваться без проблемы, better означает уже произошедшее улучшение, mixed означает улучшение с остающейся проблемой, none означает отсутствие значимого сигнала. У каждой значимой оценки приведи одну или две короткие точные цитаты только из соответствующей роли без исправлений, подстановок, внешних кавычек и многоточий. Для none оставь массив цитат пустым. Верни по одной записи для каждого id. Не переноси цитаты между ролями." },
        { role: "user", content: JSON.stringify(Object.entries(demoScenarios).map(([id, texts]) => ({ id, ...texts }))) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter вернул HTTP ${response.status}`);

  const payload = await response.json();
  const choice = payload.choices?.[0];
  if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string") {
    throw new Error("OpenRouter не вернул завершённый разбор");
  }

  const { scenarios } = JSON.parse(choice.message.content);
  if (!Array.isArray(scenarios)) throw new Error("В ответе Haiku отсутствуют сценарии");
  const expected = Object.keys(demoScenarios);
  const analyses = {};
  for (const item of scenarios) {
    if (!expected.includes(item.id) || Object.hasOwn(analyses, item.id) || !topics.includes(item.topic)) {
      throw new Error("Haiku вернул неизвестный, повторный или некорректный сценарий");
    }
    const source = demoScenarios[item.id];
    analyses[item.id] = {
      topic: item.topic,
      answer: { s: validateRole(item.intern, source.intern, item.id), n: validateRole(item.mentor, source.mentor, item.id) },
    };
  }
  if (Object.keys(analyses).length !== expected.length) throw new Error("Haiku обработал не все сценарии");

  const output = new URL("../src/app/dashboard/demo-haiku.json", import.meta.url);
  const temporary = new URL(`${output.href}.${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify({ model, analyses }, null, 2)}\n`);
  await rename(temporary, output);
  console.log(`OpenRouter: ${model}, проверено ${expected.length} синтетических сценариев.`);
}

analyze().catch((error) => {
  console.error(error instanceof SyntaxError ? "OpenRouter вернул некорректный JSON" : error.message);
  process.exitCode = 1;
});
