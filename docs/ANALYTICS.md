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
