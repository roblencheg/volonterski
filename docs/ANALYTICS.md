# Cloudflare Web Analytics

Сайт использует только Cloudflare Web Analytics. Счётчик подключается один раз в общем шаблоне всех страниц production-сборки, если задан публичный токен сайта. Без токена внешняя аналитика отключена. В dev-режиме счётчик не загружается.

## Подключение

1. В [Cloudflare Dashboard](https://dash.cloudflare.com/) откройте Web Analytics → Add a site.
2. Добавьте hostname `volonterski.ru`.
3. В Manage site скопируйте JS snippet. Из `data-cf-beacon` нужен только `token` — 32 шестнадцатеричных символа. Это публичный идентификатор сайта, не API-ключ Cloudflare.
4. В GitHub → roblencheg/volonterski → Settings → Secrets and variables → Actions → Variables задайте `CLOUDFLARE_WEB_ANALYTICS_TOKEN`.
5. Запустите Build and deploy journal. Для локальной production-сборки используется `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`.

Не включайте одновременно автоматическую вставку скрипта через Cloudflare и ручное подключение в шаблоне.

## Проверка

Выполните `npm ci`, `npm run build`, `npm run verify`. После публикации в Network должен загружаться `https://static.cloudflareinsights.com/beacon.min.js` и отправляться запрос к `https://cloudflareinsights.com/cdn-cgi/rum`. Первые данные могут появиться через несколько минут. Блокировщики могут препятствовать сбору.

Старые клиентские счётчики, уведомление и исходники собственной панели удалены из репозитория. Ранее развёрнутый Worker и накопленные данные не удаляются изменением кода сайта. Неиспользуемые ресурсы и старые переменные GitHub можно удалить отдельно в соответствующих аккаунтах.

Официальная инструкция: https://developers.cloudflare.com/web-analytics/get-started/

## Числа в подвале

Подвал показывает посещения и просмотры за последние 30 дней, только если удалось получить реальные данные. Формат: «За 30 дней: 123 посещения · 456 просмотров». Обновление — при публикации и ежедневно около 06:17 НСК (плановые GitHub Actions могут задерживаться). При ошибке API строка скрыта, а сайт продолжает собираться.

В Cloudflare создайте API-токен с минимальным правом **Account → Account Analytics → Read** для нужного аккаунта. В GitHub Settings → Secrets and variables → Actions добавьте:

- **Secret** `CLOUDFLARE_ANALYTICS_API_TOKEN` — токен чтения аналитики;
- **Variable** `CLOUDFLARE_ACCOUNT_ID` — ID аккаунта Cloudflare.

После добавления запустите Build and deploy journal вручную. Запрос GraphQL выполняется только во время сборки; в HTML попадают два числа и время обновления, а API-токен не публикуется. Beacon token для API берётся из той же переменной, что и установленный счётчик. Запрос ограничен hostname `volonterski.ru`. Посещения — метрика Cloudflare visits, а не уникальные посетители. Данные могут быть оценочными из-за sampling Cloudflare.

Запрос к реальному аккаунту необходимо проверить после настройки доступа; локальные проверки с ответами-заглушками не подтверждают разрешения и доступность набора RUM для конкретного аккаунта.
