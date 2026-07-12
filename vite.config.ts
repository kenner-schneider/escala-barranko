import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: "base" deve ser '/<nome-do-repo>/'. Troque aqui se o repo tiver outro nome.
export default defineConfig({
  plugins: [react()],
  base: '/escala-barranko/',
})
