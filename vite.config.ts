import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/app-vigas-pro/',  // <--- IMPORTANTE: Debe ser el nombre exacto de tu repo entre barras
})