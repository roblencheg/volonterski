import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string().min(1), description: z.string().min(1),
    date: z.coerce.date(), updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]), draft: z.boolean().default(false),
    attachments: z.array(z.object({ name: z.string(), url: z.string().regex(/^\/files\/[a-z0-9][a-z0-9/_.-]*$/), size: z.string().optional() })).default([])
  })
});
export const collections = { articles };
