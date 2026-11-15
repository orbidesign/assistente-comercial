import { defineConfig } from 'vite';

export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: { chunkSizeWarningLimit: 900, rollupOptions: { input: { main: 'index.html', arena: 'arena.html', ceo: 'ceo.html' } } },
});
