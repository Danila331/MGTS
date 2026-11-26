# API contract v1

Base URL: `/api/v1`. JSON. Demo actor: `X-Actor-ID` header; if absent backend uses HR demo actor. All list endpoints accept `actor_id` query as demo fallback. Backend enforces scope on every request.

## Common

- `GET /health` → `{status, version, storage}`
- `GET /actors` → `{items: Actor[]}` demo role switcher
- `GET /bootstrap` → `{actor, actors, settings, counts}`
- `Actor`: `{id, name, role: hr|manager|mentor|intern, team_id?, internship_id?, initials}`
- Errors: `{error: {code, message}}`; 400/401/403/404/409/500.

## Dashboard / internships

- `GET /dashboard` → `{metrics, attention_signals, dimension_trends, cohorts, coverage, ai_briefing, updated_at}`
- `GET /interns?search=&team_id=&cohort_id=&signal=&page=` → `{items, total}`
- `GET /interns/{id}` → `{internship, participants, metrics, trends, timeline, signals, actions, responses, feedback, development}`
- `PATCH /internships/{id}` → update stage/settings as HR.

Internship list item includes `{id, intern:{id,name,initials}, program, cohort, team, stage, manager, mentor, progress, coverage, dynamics, signal_count, last_activity}`.

## Surveys

- `GET /surveys` → `{items, total}`
- `POST /surveys` → create draft
- `GET /surveys/{id}` → `{survey, questions, assignments, coverage, responses}`
- `PATCH /surveys/{id}` → update template/questions
- `POST /surveys/{id}/publish`
- `POST /surveys/{id}/assign`
- `GET /surveys/{id}/take` → role-scoped form and draft
- `PUT /surveys/{id}/draft` → autosave `{answers}`
- `POST /surveys/{id}/submit` → submit `{answers}` and recalculate analytics/signals
- `GET /surveys/responses/export?format=xlsx` → one workbook for both Pulse forms
- `GET /surveys/responses/export?format=csv&audience=intern|mentor` → a UTF-8 CSV for one form
- `POST /surveys/responses/import?format=xlsx|csv` → raw file body, up to 2 MiB, returns `{imported, skipped}`

File endpoints require an explicit HR demo actor. Import uses the MGTS column names and matches an existing internship and a control period from 1 to 6. An identical submitted answer is skipped. A conflicting or invalid row rejects the whole file.

Survey includes `{id,title,description,status,audience,period,due_at,wave,questions,coverage}`; question `{id,type:text|scale|single|multiple,title,required,dimension,min,max,options}`.

## Feedback

- `GET /feedback?box=inbox|outbox` → `{items,requests,recommendations}`
- `POST /feedback` → create feedback/draft
- `PATCH /feedback/{id}` → edit
- `POST /feedback/{id}/publish`
- `POST /feedback/requests`
- `POST /feedback/{id}/ai-summary`

## Signals / actions

- `GET /signals?status=&urgency=&owner_id=` → `{items,total}`
- `GET /signals/{id}` → signal with evidence/actions/history
- `PATCH /signals/{id}` → status/urgency/owner/due date
- `POST /signals/{id}/actions` → `{title,owner_id,due_at}`
- `PATCH /actions/{id}` → status/result/comment

Signal includes `{id,title,scope,internship_id,dimension,urgency,evidence_strength,status,summary,rule,evidence,owner,due_at,created_at,actions}`.

## Reviews / diagnostics / development

- `GET /reviews` → `{items,distribution}`
- `POST /reviews` → create self review/manager review
- `GET /reviews/{id}`
- `PATCH /reviews/{id}`
- `POST /reviews/{id}/analyze`
- `POST /reviews/{id}/calibrate`
- `POST /reviews/{id}/announce`
- `GET /diagnostics` / `POST /diagnostics`
- `POST /diagnostics/{id}/complete`
- `GET /development` / `POST /development/goals`
- `PATCH /development/goals/{id}`

## AI

- `POST /ai/query` `{question, internship_id?}` → `{answer,evidence,model,created_at}`
- `POST /ai/analyze` `{kind:self_feedback|manager_reasoning|final_feedback,text,context_id?}` → `{result,suggestions,draft,evidence}`
- `POST /ai/edit` `{text,instruction}` → `{text}`

## Integrations / settings

- `GET /integrations` → `{items,journal}`
- `POST /integrations/{id}/sync` → mock sync with new normalized data and journal entry
- `POST /integrations/surveys/webhook` → external response ingestion, idempotent
- `GET /settings` / `PATCH /settings` including `{show_feedback_to_intern, signal_thresholds}`

All mutation endpoints return the changed entity. All GET responses are scoped to current actor.

## Пилот Пульса

- `GET /dashboard` возвращает `attention_queue` для HR с причиной, периодом и статусом шага. Светофор учитывает сигналы последнего контрольного периода.
- `GET /interns/:id` возвращает HR поле `survey_analysis` с выводом модели, цитатами, статусом обработки, сигналами и шагом.
- `POST /interns/:id/analysis/retry` перезапускает исчерпанную задачу ИИ по инициативе HR.
- `PUT /interns/:id/follow-up` сохраняет от HR `note` и `status` (`in_progress` или `done`). Передача `review_version` из карточки защищает от сохранения шага поверх изменившейся анкеты или правки другого HR.
- `GET /surveys/:id/tally-invites` возвращает HR персональные ссылки для открытых назначений.
- `POST /integrations/tally/webhook` принимает подписанный Tally JSON. Старый универсальный вебхук включён в деморежиме.
- `GET /integrations/status` возвращает состояние конфигурации Tally и Huntflow для HR.
- `GET /interns/:id/candidate` и `PUT /interns/:id/candidate` показывают и меняют привязку к Huntflow. `candidate_id: 0` отвязывает запись.
