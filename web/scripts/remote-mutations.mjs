import assert from "node:assert/strict";
const base = process.env.REMOTE_API_URL ?? "http://127.0.0.1:8080/api/v1";
const actor = "actor-hr";
async function call(path, method = "GET", body, actorId = actor) {
  const response = await fetch(`${base}${path}`, { method, headers: { "X-Actor-ID": actorId, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}
const unique = Date.now();

const original = await call("/interns/internship-01");
await call("/internships/internship-01", "PATCH", { stage: "active" });
assert.equal((await call("/interns/internship-01")).internship.stage, "active");
await call("/internships/internship-01", "PATCH", { stage: original.internship.stage });
console.log("OK internship PATCH + GET restore");

const survey = await call("/surveys", "POST", { title: `API mutation ${unique}`, description: "remote verification", audience: "intern", due_at: "2026-12-20T00:00:00Z" });
await call(`/surveys/${survey.id}`, "PATCH", { questions: [{ id: "q-api", type: "scale", title: "Оценка", required: true, dimension: "experience", min: 1, max: 5, version: 1 }, { id: "q-api-text", type: "text", title: "Комментарий", required: true, dimension: "experience", version: 1 }] });
await call(`/surveys/${survey.id}/publish`, "POST", {});
await call(`/surveys/${survey.id}/assign`, "POST", { internship_ids: ["internship-01"] });
await call(`/surveys/${survey.id}/draft`, "PUT", { answers: { "q-api": 4 } }, "actor-intern-01");
assert.equal((await call(`/surveys/${survey.id}/take`, "GET", undefined, "actor-intern-01")).draft.answers["q-api"], 4);
await call(`/surveys/${survey.id}/submit`, "POST", { answers: { "q-api": 4, "q-api-text": "Проверка submit и GET" } }, "actor-intern-01");
const surveyDetail = await call(`/surveys/${survey.id}`);
assert.ok(surveyDetail.responses.some((item) => item.answers["q-api-text"] === "Проверка submit и GET"));
console.log("OK survey create/patch/publish/assign/draft/submit + GET");

const feedback = await call("/feedback", "POST", { internship_id: "internship-01", recipient: "Данияр Ибрагимов", relation: "mentor", frequency: "weekly", sentiment: "positive", strengths: "Качество", growth: "Метрики", text: "Черновик remote", status: "draft" });
await call(`/feedback/${feedback.id}`, "PATCH", { text: "Опубликованный remote отзыв" });
await call(`/feedback/${feedback.id}/publish`, "POST", {});
const feedbackList = await call("/feedback?box=outbox");
assert.equal(feedbackList.items.find((item) => item.id === feedback.id).status, "published");
await call(`/feedback/${feedback.id}/ai-summary`, "POST", {});
const request = await call("/feedback/requests", "POST", { internship_id: "internship-01", recipient_id: "actor-mentor-1", message: "Проверочный запрос отзыва" });
assert.ok((await call("/feedback?box=inbox")).requests.some((item) => item.id === request.id));
console.log("OK feedback create/patch/publish/request/AI + GET");

const signalId = "auto-help-internship-08";
await call(`/signals/${signalId}`, "PATCH", { owner_id: "actor-manager-core", status: "confirmed" });
const action = await call(`/signals/${signalId}/actions`, "POST", { title: `API action ${unique}`, owner_id: "actor-manager-core", due_at: "2026-12-05T00:00:00Z" });
assert.ok((await call(`/signals/${signalId}`)).actions.some((item) => item.id === action.id));
await call(`/actions/${action.id}`, "PATCH", { status: "done", result: "Проверено remote mutation" });
assert.ok(["done", "completed"].includes((await call(`/signals/${signalId}`)).actions.find((item) => item.id === action.id).status));
await call(`/signals/${signalId}`, "PATCH", { status: "resolved" });
assert.equal((await call(`/signals/${signalId}`)).status, "resolved");
await call(`/signals/${signalId}`, "PATCH", { status: "confirmed" });
console.log("OK signal owner/confirm/action/complete/resolve + GET");

const review = await call("/reviews", "POST", { internship_id: "internship-01", kind: "final_feedback", text: "Remote review draft", score: 4, recommended_level: "junior" });
await call(`/reviews/${review.id}`, "PATCH", { text: "Remote review saved", score: 4, recommended_level: "junior" });
await call(`/reviews/${review.id}/analyze`, "POST", {});
await call(`/reviews/${review.id}/calibrate`, "POST", {});
assert.equal((await call(`/reviews/${review.id}`)).status, "calibrated");
await call(`/reviews/${review.id}/announce`, "POST", {});
assert.equal((await call(`/reviews/${review.id}`)).status, "announced");
console.log("OK review create/patch/analyze/calibrate/announce + GET");

const diagnostic = await call("/diagnostics", "POST", { internship_id: "internship-01", kind: 180, due_at: "2026-12-20T00:00:00Z" });
assert.ok((await call("/diagnostics")).items.some((item) => item.id === diagnostic.id));
await call("/diagnostics/diagnostic-seed-01/complete", "POST", {});
assert.equal((await call("/diagnostics")).items.find((item) => item.id === "diagnostic-seed-01").status, "completed");
console.log("OK diagnostics create/complete + GET");

const goal = await call("/development/goals", "POST", { internship_id: "internship-01", title: `API goal ${unique}`, description: "Remote verification", due_at: "2026-12-20T00:00:00Z" });
await call(`/development/goals/${goal.id}`, "PATCH", { progress: 100 });
assert.equal((await call("/development")).items.find((item) => item.id === goal.id).progress, 100);
console.log("OK development create/patch + GET");

await call("/integrations/integration-surveys/sync", "POST", {});
const integrations = await call("/integrations");
assert.ok(integrations.journal.length > 0);
console.log("OK integration sync + GET journal");

await call("/settings", "PATCH", { show_feedback_to_intern: false, signal_thresholds: { low: 2.5, positive: 4.5 } });
assert.equal((await call("/settings")).show_feedback_to_intern, false);
await call("/settings", "PATCH", { show_feedback_to_intern: true, signal_thresholds: { low: 2.5, positive: 4.5 } });
assert.equal((await call("/settings")).show_feedback_to_intern, true);
console.log("OK settings PATCH false/true + GET");

await call("/ai/query", "POST", { question: "Покажи метрики", internship_id: "internship-01" });
await call("/ai/analyze", "POST", { kind: "self_feedback", text: "Сделал три задачи", context_id: "internship-01" });
await call("/ai/edit", "POST", { text: "Сделал три задачи", instruction: "Уточни" });
console.log("OK AI query/analyze/edit remote");
console.log("REMOTE MUTATIONS PASS: every mutation confirmed by subsequent GET where applicable");
