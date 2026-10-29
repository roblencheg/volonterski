import { defineConfig } from 'astro/config';
export default defineConfig({ site: 'https://volonterski.ru', output: 'static', trailingSlash: 'always', markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } } } });
