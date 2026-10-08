import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: { input: { camera: 'index.html', impact: 'impact-lab/index.html' } } },
});
