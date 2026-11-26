# MGTS Internship Intelligence — backend

Go backend для HR-платформы: Echo, Zerolog, модульный монолит с ручным DI, чистыми `domain` / `usecase` / `transport` / `storage`, общими портами для PostgreSQL и автономного in-memory режима. ORM не используется.

## Быстрый запуск без Docker

Требуется Go 1.23 или новее. По умолчанию используется memory storage и порт `8080`.

```bash
cd backend
go run ./cmd/api
```

Проверка:

```bash
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/dashboard
curl -H 'X-Actor-ID: actor-intern-01' http://localhost:8080/api/v1/surveys
```

При старте создаются 10 стажёров, 3 команды, 3 потока, актёры всех 4 ролей, 5 анкет, несколько волн и более 30 ответов, метрики, положительные и негативные сигналы, отзывы, review, диагностики, цели и 4 mock-интеграции. Все изменения сохраняются в памяти процесса до его остановки.

### Демо-акторы

Actor передаётся заголовком `X-Actor-ID` или query-параметром `actor_id`. Без него используется `actor-hr`.

| Роль | Примеры ID |
|---|---|
| HR | `actor-hr` |
| Manager | `actor-manager-core`, `actor-manager-data`, `actor-manager-mobile` |
| Mentor | `actor-mentor-1` … `actor-mentor-4` |
| Intern | `actor-intern-01` … `actor-intern-10` |

Полный список: `GET /api/v1/actors`. Роль `mentor` объединяет наставника, ментора и buddy; роли recruiter нет.

## PostgreSQL

Целевое хранилище — PostgreSQL. Адаптер использует `pgx/v5/pgxpool`, транзакционный `SELECT … FOR UPDATE` и JSONB-агрегат `app_state`; SQL-запросы встроены через `go:embed`. Миграции покрывают также нормализованную схему основного домена.

```bash
createdb mgts
export STORAGE=postgres
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/mgts?sslmode=disable'
go run ./cmd/migrate
go run ./cmd/api
```

Первый запуск API заполняет пустую базу теми же seed-данными. Откат последней миграции и статус:

```bash
go run ./cmd/migrate -down
go run ./cmd/migrate -status
```

Runner применяет `up/down` файлы в транзакциях, проверяет SHA-256 checksum и сериализует запуски через PostgreSQL advisory lock. Перед `go run ./cmd/api` миграции должны быть применены.

## Worker

```bash
STORAGE=memory go run ./cmd/worker
# либо тот же STORAGE=postgres и DATABASE_URL, что у API
```

Worker обрабатывает уведомления и создаёт напоминания о просроченных назначениях. Для общего состояния worker и API должны использовать одну PostgreSQL-базу; memory worker автономен и имеет собственную копию.

## Конфигурация

| Env | Default | Назначение |
|---|---|---|
| `PORT` | `8080` | HTTP-порт |
| `STORAGE` | `memory` | `memory` или `postgres` |
| `DATABASE_URL` | локальный PostgreSQL | DSN для `STORAGE=postgres` |
| `LOG_LEVEL` | `info` | уровень Zerolog |
| `VERSION` | `1.0.0` | версия в `/health` |

Пример находится в `.env.example`; переменные нужно экспортировать в shell, автоматическая загрузка `.env` не используется.

## API

Base URL: `/api/v1`. Реализованы:

- health, actors, bootstrap, dashboard, interns и обновление internship;
- surveys CRUD, publish, assign, take, draft, submit;
- feedback, requests, publish, AI-summary;
- signals, ручной статус/владелец, actions и результат;
- reviews, AI-анализ, calibrate, announce;
- diagnostics 180/270/360 с кворумом, development goals;
- локальные детерминированные AI query/analyze/edit с evidence и журналом;
- integrations list/mock sync и идемпотентный surveys webhook;
- settings, включая реально действующий `show_feedback_to_intern`.

Submit анкеты атомарно обновляет ответ, назначение, metric points и rule-based сигналы. Повторный submit создаёт новую версию ответа. Внешний импорт идемпотентен по `(external_id, version)`; новая версия вытесняет предыдущую из аналитики. Сигналы не закрываются и не переоткрываются автоматически.

## Архитектура

```text
cmd/{api,worker,migrate}
internal/
  app/                         ручной DI
  platform/{config,loggerx,postgres}
  modules/
    core/{domain,ports,usecase}
    identity/usecase           RBAC и области доступа
    analytics/usecase          метрики и rule-based сигналы
    insights/usecase           сменяемый локальный AI provider
  transport/httptransport      Echo, middleware, HTTP DTO
  storage/{memory,postgres}    реализации общего Store/UoW port
migrations/                    embedded SQL up/down
```

`Store.Update` — атомарная unit-of-work граница. Memory делает изолированную копию состояния под mutex; PostgreSQL выполняет callback внутри транзакции с блокировкой агрегата. HTTP DTO отделены от domain-модели.

## Проверки

```bash
gofmt -w cmd internal migrations
go test ./...
go test -race ./...
go vet ./...
go build ./cmd/...
```

Тесты покрывают RBAC всех ролей, видимость feedback, survey draft/validation/submit и пересчёт, ручной lifecycle сигнала и действия, idempotency и версии webhook, CRUD анкет, feedback, review, диагностики, цели, AI scope/evidence, интеграции и атомарность memory store.

## Известные ограничения

- Демо-аутентификация через actor ID намеренно не является безопасной production-аутентификацией; перед промышленным запуском нужен SSO/JWT с серверной привязкой actor.
- AI provider локальный и детерминированный, без внешней LLM. Он формирует проверяемые эвристические результаты, а не полноценный генеративный анализ.
- Интеграции являются mock-провайдерами; webhook демонстрирует нормализацию и идемпотентность, но не содержит production-подписи внешнего провайдера.
- PostgreSQL runtime использует единый JSONB-агрегат. Нормализованные таблицы из миграции предназначены для дальнейшей reporting/integration-проекции и сейчас не дублируются из `app_state`; конкурентные записи сериализуются блокировкой одной строки.
- Автоматические API-тесты работают на memory adapter. Для PostgreSQL нужна запущенная база; в автономной проверке live-миграции и PostgreSQL integration tests не выполняются.
