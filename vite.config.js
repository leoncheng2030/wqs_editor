import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const baseConfig = {
    plugins: [vue()],
  }

  if (mode === 'lib') {
    return {
      ...baseConfig,
      build: {
        outDir: 'dist-lib',
        lib: {
          entry: 'src/lib/index.js',
          name: 'VueMarkdownEditor',
          fileName: format => `vue-markdown-editor.${format}.js`,
        },
        rollupOptions: {
          external: ['vue', 'marked'],
          output: {
            globals: {
              vue: 'Vue',
              marked: 'marked',
            },
          },
        },
      },
    }
  }

  return baseConfig
})
