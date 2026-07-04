import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kita',
    short_name: 'Kita',
    description: 'Family finances for CH & JC',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf6f0',
    theme_color: '#c4623d',
    icons: [
      { src: '/icons/kita-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/kita-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/kita-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
