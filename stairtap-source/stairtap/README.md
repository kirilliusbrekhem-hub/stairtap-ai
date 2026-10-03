# STAIRTAP

Идея → ИИ → стартап. Next.js (статический экспорт) + один Cloudflare Worker (API, D1, Gemini, платежи, публикация сайтов).

- `app/`, `components/`, `lib/` — интерфейс (RU/EN, `lib/dict.ts` — переводы)
- `worker/` — бэкенд: `auth.ts`, `api.ts`, `gemini.ts`, `site.ts`, `billing.ts`
- `lib/plans.ts` — тарифы, лимиты и цены (используются и сервером, и интерфейсом)
- `wrangler.jsonc` — конфигурация Cloudflare

Запуск и настройка: см. **DEPLOY.md**.
