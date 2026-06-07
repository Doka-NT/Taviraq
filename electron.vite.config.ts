// SPDX-License-Identifier: MPL-2.0
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    // Bake the Aptabase telemetry key into the bundle at build time. A packaged
    // app launched from Finder has no shell environment, so this can never be
    // read from `process.env` at runtime — it must be injected here. Empty
    // unless the release build sets TAVIRAQ_APTABASE_KEY, which keeps opt-in
    // telemetry a no-op until a key is configured.
    define: {
      __APTABASE_KEY__: JSON.stringify(process.env.TAVIRAQ_APTABASE_KEY ?? '')
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    plugins: [react()],
    server: {
      host: '127.0.0.1'
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer/src')
      }
    }
  }
})
