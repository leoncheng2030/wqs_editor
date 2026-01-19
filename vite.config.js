import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const baseConfig = {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  }

  if (mode === 'lib') {
    return {
      ...baseConfig,
      build: {
        outDir: 'dist-lib',
        lib: {
          entry: 'src/lib/index.ts',
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
