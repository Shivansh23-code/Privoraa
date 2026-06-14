import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Split heavy vendor libs into their own chunks so no single bundle blows past
    // the warning limit and the browser can cache them independently.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // Markdown + math + syntax highlighting is the heaviest cluster.
          if (
            /katex|highlight\.js|lowlight|react-markdown|remark|rehype|hast|mdast|micromark|unist|property-information|character-entities|space-separated-tokens|comma-separated-tokens/.test(id)
          ) {
            return 'markdown'
          }
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react-dom') || id.includes('/scheduler/') || /node_modules\/react\//.test(id)) {
            return 'react'
          }
          return 'vendor'
        },
      },
    },
  },
})
