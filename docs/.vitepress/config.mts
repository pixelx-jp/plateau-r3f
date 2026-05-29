import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '@plateau/r3f',
  description:
    'React Three Fiber library for PLATEAU 3D Tiles with attribute coloring and hazard layers.',
  // GitHub Pages base path. Override with DOCS_BASE for custom domains.
  base: process.env.DOCS_BASE ?? '/plateau-r3f/',
  head: [
    ['link', { rel: 'icon', href: '/plateau-r3f/favicon.ico' }],
    ['meta', { property: 'og:title', content: '@plateau/r3f' }],
    ['meta', { property: 'og:description', content: 'PLATEAU 3D Tiles for React Three Fiber' }],
    ['meta', { property: 'og:url', content: 'https://pixelx-jp.github.io/plateau-r3f/' }],
  ],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      {
        text: 'GitHub',
        link: 'https://github.com/pixelx-jp/plateau-r3f',
      },
      {
        text: 'Yodo Labs',
        link: 'https://yodolabs.jp',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Install', link: '/guide/install' },
            { text: 'Quick start', link: '/guide/quick-start' },
            { text: 'Artifacts layout', link: '/guide/artifacts' },
          ],
        },
        {
          text: 'Concepts',
          items: [
            { text: 'colorBy + hazard composition', link: '/guide/coloring' },
            { text: 'Fallback levels', link: '/guide/fallback' },
            { text: 'Attribution', link: '/guide/attribution' },
          ],
        },
        {
          text: 'Extending',
          items: [
            { text: 'Custom hazard layer', link: '/guide/custom-hazard' },
            { text: 'Custom resolver', link: '/guide/custom-resolver' },
            { text: 'Shader extensions', link: '/guide/shader-extensions' },
            { text: 'Worker decoder', link: '/guide/worker-decoder' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API reference',
          items: [
            { text: 'Components', link: '/api/components' },
            { text: 'Hooks', link: '/api/hooks' },
            { text: 'Runtime', link: '/api/runtime' },
            { text: 'Types', link: '/api/types' },
          ],
        },
      ],
    },
    footer: {
      message:
        'MIT License. PLATEAU data © Project PLATEAU / MLIT — CC BY 4.0.',
      copyright:
        'Built by <a href="https://yodolabs.jp">Yodo Labs</a> · PixelX Inc.',
    },
    search: { provider: 'local' },
  },
});
