# Автономная веб-аналитика без собственного сервера

Основной вариант: **Cloudflare Workers + Cloudflare D1**. Это облачный backend и SQL-хранилище на бесплатном тарифе. GitHub Pages продолжает обслуживать сайт, а Worker получает метрики. Собственный VPS, Docker, PostgreSQL и открытые порты не нужны.

Исходники: `analytics/cloudflare/`. Старый вариант с Docker заменён Cloudflare-реализацией.

## Как устроено

```text
Браузер → volonterski.ru (GitHub Pages)
          └── /metrics.js → https://<worker>.workers.dev/collect
                                └── Cloudflare Worker → D1
                                                     ↳ /dashboard
                                                     ↳ /api/report
```

Считаем просмотры, число вкладочных сессий, страницы, источники и события (дочитывание, GitHub, скачивания, копирование, поиск). Поисковые фразы, полные URL переходов, IP и user-agent в D1 не записываются. Идентификатор случайной сессии хешируется на сервере с секретом. Сырые хеши сессий удаляются по ежедневному расписанию, агрегаты сохраняются.

## Однократная активация Cloudflare

1. Используй созданный аккаунт [Cloudflare](https://dash.cloudflare.com/).
2. Workers & Pages → Create application → импорт GitHub репозитория `roblencheg/volonterski`. Создай Worker с именем **volonterski-analytics**. Root directory: **analytics/cloudflare**. Build command не нужен; deploy command **npm run deploy**. База D1 `volonterski-analytics` уже создана, а её `database_id` указан в `wrangler.jsonc`. Команда развёртывания сначала применит SQL-миграции, затем опубликует Worker.
3. В настройках Worker (Settings → Variables and Secrets) добавь **секреты**: `SESSION_SALT` (случайная строка не короче 32 символов), `ADMIN_USER` (логин) и `ADMIN_PASSWORD` (случайный пароль от 16 символов). Не коммить и не присылай эти значения в чат. После сохранения настроек убедись, что Worker развернулся с обновлёнными секретами.
4. Открой `https://<выданный-subdomain>.workers.dev/health` — ответ `ok`. По адресу `/dashboard` должна появиться HTTP Basic Auth; после входа — панель статистики.
5. В GitHub → Settings → Secrets and variables → Actions → Variables добавь `ANALYTICS_ENDPOINT=https://<выданный-subdomain>.workers.dev/collect`. Затем запусти `Build and deploy journal` на GitHub Actions. Сборщик добавит публичный счётчик на все страницы.

Workers.dev не требует изменения DNS домена volonterski.ru или его переноса с GitHub Pages. Параметр endpoint публичный и **не содержит секретов**. Пока он не настроен, счётчик не загружается и сайт продолжает работать.

В Workers Builds можно включить автодеплой при изменении файлов `analytics/cloudflare/**`, чтобы не запускать лишние сборки при публикации статей.

### Проверка после запуска

На сайте открой DevTools → Network, убедись, что POST на `/collect` возвращает **204**. Затем открой `/dashboard` на выданном Cloudflare адресе и проверь просмотры. При 503 проверь D1 binding, применённые миграции и `SESSION_SALT`; при 403 проверь заголовок Origin и URL сайта.

Локальная проверка: `node --test analytics/cloudflare/worker.test.mjs`. Для расширенной разработки в каталоге `analytics/cloudflare` можно использовать `npm install`, `npx wrangler dev` и `npm run deploy`.

### О тарифе и безопасности

На 31 октября 2026 Workers Free включает до 100 тысяч запросов в день, D1 Free — до 5 млн прочитанных и 100 тысяч записанных строк в день и 5 ГБ хранилища. Превышение лимита может временно остановить запись метрик; обычный сайт останется доступным. Проверяй актуальные условия Cloudflare.

Дашборд и отчёт закрыты HTTP Basic Auth через HTTPS; секреты хранятся только в Cloudflare. Для усиления защиты можно дополнительно поставить Cloudflare Access. Endpoint `/collect` публичный: проверка Origin уменьшает случайные сторонние вызовы, но не защищает от подделки метрик через curl. При росте трафика полезны WAF/rate-limit и контроль квот. IP может обрабатываться инфраструктурой Cloudflare для маршрутизации и безопасности, но наш Worker его не сохраняет.

Microsoft Clarity остаётся отдельным инструментом записи сессий, его подключение не требуется для работы собственной аналитики. Информационное уведомление сайта и правовые основания обработки данных нужно поддерживать в соответствии с применимыми требованиями.

### Обслуживание

Данные остаются в Cloudflare D1, а не GitHub. Для резервного копирования используй экспорт/backup D1 в панели Cloudflare. Если удалить Worker и D1 без резервной копии, история будет потеряна.

Основные исходники:
- `analytics/cloudflare/worker.mjs` — API и закрытая панель;
- `analytics/cloudflare/migrations/0001_init.sql` — схема данных;
- `analytics/cloudflare/wrangler.jsonc` — конфигурация Cloudflare;
- `public/metrics.js` — клиент на сайте.
