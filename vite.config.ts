import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/')
          if (!moduleId.includes('/node_modules/')) return

          if (/\/node_modules\/(react|react-dom|react-reconciler|scheduler)\//.test(moduleId)) {
            return 'react-vendor'
          }
          if (/\/node_modules\/three\/build\/three\.core\.js$/.test(moduleId)) {
            return 'three-core-vendor'
          }
          if (/\/node_modules\/three\//.test(moduleId)) {
            return 'three-vendor'
          }
          if (/\/node_modules\/(@react-three\/(fiber|drei|postprocessing)|postprocessing|three-stdlib|three-mesh-bvh)\//.test(moduleId)) {
            return 'r3f-vendor'
          }
          if (/\/node_modules\/(gsap|lenis)\//.test(moduleId)) {
            return 'motion-vendor'
          }
          if (/\/node_modules\/@google\/genai\//.test(moduleId)) {
            return 'genai-vendor'
          }
        },
      },
    },
  },
})
