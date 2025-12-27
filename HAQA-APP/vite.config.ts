import { defineConfig, type ViteDevServer } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin to handle graceful shutdown and port cleanup
const gracefulShutdownPlugin = () => {
  return {
    name: 'graceful-shutdown',
    configureServer(server: ViteDevServer) {
      const cleanup = async () => {
        try {
          await server.close()
          process.exit(0)
        } catch (error) {
          console.error('Error during cleanup:', error)
          process.exit(1)
        }
      }

      // Handle SIGINT (Ctrl+C)
      process.on('SIGINT', cleanup)
      // Handle SIGTERM
      process.on('SIGTERM', cleanup)
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error)
        cleanup()
      })

      // Cleanup on process exit
      process.on('exit', () => {
        try {
          server.close()
        } catch (error) {
          // Ignore errors during exit cleanup
        }
      })
    },
  }
}

const config = defineConfig({
  plugins: [
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: [path.resolve(__dirname, './tsconfig.json')],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    gracefulShutdownPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Allow fallback to next available port if 3000 is busy
  },
})

export default config
