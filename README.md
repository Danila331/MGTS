# MGTS Internship Intelligence

Веб-приложение для анализа опыта стажёров: встроенные и внешние анкеты, обратная связь, динамика, AI-сигналы, действия, review, диагностики 180/270/360 и планы развития.

## Стек

- `web/` — Next.js, TypeScript, App Router, shadcn/ui. Дизайн-система перенесена из `Danila331/mts-ai`.
- `backend/` — Go, Echo, Zerolog, модульный монолит по образцу `Danila331/opora`.
- PostgreSQL, `pgx/v5`, SQL-файлы и миграции без ORM.
- Автономный in-memory адаптер для демонстрации без внешних зависимостей.

Продуктовые требования: `docs/PRD.md`. API-контракт: `docs/API.md`. Идеи после текущей сборки: `docs/BACKLOG.md`.

## Быстрый запуск

Требуются Go и Node.js.

```bash
# Терминал 1 — API на :8080
make backend

# Терминал 2 — frontend
cd web
npm install
npm run dev
```

Откройте адрес, который выведет Next.js. API доступен на `http://localhost:8080/api/v1`.

По умолчанию используется `STORAGE=memory` и загружаются реалистичные демонстрационные данные. Переключатель актора в интерфейсе позволяет проверить HR, руководителя, наставника и стажёра.

Frontend работает в режиме `NEXT_PUBLIC_API_MODE=auto`: сначала использует Go API, а при его сетевой недоступности — автономный typed mock. Для строгой проверки только реального backend используйте `remote`; для полностью автономной работы — `mock`.

## PostgreSQL

```bash
export STORAGE=postgres
export DATABASE_URL='postgres://mgts:mgts@localhost:5432/mgts?sslmode=disable'
make migrate
make backend
```

Миграции расположены в `backend/migrations`. Для production API, worker и migrate собираются как отдельные процессы одного Go-монолита.

При установленном Docker вся backend-среда поднимается командой:

```bash
docker compose up --build
```

Она создаёт PostgreSQL, применяет миграции и запускает API с worker.

## Проверки

```bash
make test-backend       # go test + go vet
make test-frontend      # typecheck + lint + production build
make smoke              # smoke API; сервер должен быть запущен
make rbac-smoke         # ограничения ролей на живом API

# Browser-проверки frontend против Go на :7100
cd web
SMOKE_API_MODE=remote SMOKE_URL=http://127.0.0.1:7100 npm run test:smoke
SMOKE_API_MODE=remote SMOKE_URL=http://127.0.0.1:7100 npm run test:workflows
SMOKE_URL=http://127.0.0.1:7100 npm run test:a11y
```

## Основные разделы

- Обзор программы и аналитика динамики.
- Стажёры и карточка стажировки.
- Конструктор, публикация и прохождение анкет.
- Отзывы, запросы и AI-резюме.
- Центр сигналов и действия.
- Review, калибровка и объявление результатов.
- Диагностики 180/270/360.
- Планы развития.
- AI-запросы к авторизованной аналитике.
- Интеграции и настройки видимости.

## Деплой

Корневой `Dockerfile` собирает Go API, worker и migrate в non-root Alpine-образ. `vercel.json` запускает production-сборку Next.js из `web/`.
