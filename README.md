# volonterski

Личный журнал решений и результатов. Astro, Markdown, GitHub Pages. Без сервера, базы данных, внешних шрифтов и API-ключей.

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
