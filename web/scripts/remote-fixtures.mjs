import assert from "node:assert/strict";

const base = process.env.REMOTE_API_URL ?? "http://127.0.0.1:8080/api/v1";
const headers = { "X-Actor-ID": "actor-hr", "Content-Type": "application/json" };
async function call(path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

export async function createRemoteTakeSurvey() {
  const survey = await call("/surveys", "POST", { title: `Remote autosave ${Date.now()}`, description: "Свежая волна для browser smoke", audience: "intern", due_at: "2026-12-20T00:00:00Z" });
  await call(`/surveys/${survey.id}`, "PATCH", { questions: [
    { id: "q-remote-scale", type: "scale", title: "Оцените эту проверочную волну", required: true, dimension: "experience", min: 1, max: 5, version: 1 },
    { id: "q-remote-text", type: "text", title: "Добавьте комментарий", required: true, dimension: "experience", version: 1 },
  ] });
  await call(`/surveys/${survey.id}/publish`, "POST", {});
  await call(`/surveys/${survey.id}/assign`, "POST", { internship_ids: ["internship-01"] });
  const detail = await call(`/surveys/${survey.id}`);
  assert.equal(detail.survey.status, "published");
  assert.equal(detail.assignments.length, 1);
  return survey.id;
}
