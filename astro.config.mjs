// @ts-check
import { defineConfig } from 'astro/config';

import rehypeAddClasses from './src/rehype/rehype-add-classes';
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import react from '@astrojs/react';
import {h} from 'hastscript';
import tailwind from '@astrojs/tailwind';


import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [react(), tailwind(), mdx()],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      langs: []
    },
    syntaxHighlight: "shiki",
    rehypePlugins: [rehypeAddClasses, rehypeSlug, [rehypeAutolinkHeadings, {behavior: 'wrap'}]]
  }
});