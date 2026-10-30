# volonterski

Личный журнал решений и результатов. Astro, Markdown, GitHub Pages. Сам сайт не требует собственного сервера, базы данных, внешних шрифтов и API-ключей. Опциональная аналитика использует Cloudflare Workers и D1.

Адрес после подключения DNS: https://volonterski.ru.

## Разработка

Node.js 22.12+.

```sh
npm ci
npm run dev
npm run build
npm run verify
```

## Публикация

Статьи — src/content/articles/*.md, вложения — public/files/<article-id>/. Черновики исключаются из HTML, поиска, RSS и sitemap, но исходники остаются публичными в GitHub.

Коммит в main запускает сборку и GitHub Pages. Сначала включить Source: GitHub Actions в Settings → Pages, указать Custom domain и настроить DNS. Инструкции: [домен](docs/DOMAIN.md), [публикация из чата](docs/PUBLISHING.md), [правила агента](AGENTS.md).

Возможности: адаптивная вёрстка, светлая/тёмная тема, поиск по полным текстам и фильтры, время чтения, оглавление, подсветка/копирование кода, вложения, RSS, sitemap и Open Graph. Поиск локальный, запросы не отправляются на сервер.

## Поиск и обновления

Автоматические PNG-превью, BlogPosting JSON-LD, связанные статьи, IndexNow после деплоя и мониторинг релизов проектов. [Устройство автоматизации и статус подключений](docs/PROMOTION.md).

## Автономная аналитика

Счётчик сайта и закрытая панель статистики могут работать без собственного сервера через Cloudflare Workers + D1. Код: [analytics/cloudflare](analytics/cloudflare), [подключение](analytics/README.md). До создания Cloudflare Worker и настройки `ANALYTICS_ENDPOINT` сбор собственных метрик выключен.
