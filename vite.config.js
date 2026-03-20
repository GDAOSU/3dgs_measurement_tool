import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  // For dev, we always use root. For prod, we use the determined base path.
  base: '/',
  plugins: [react(), cesium()],
  server: {
    port: 5173,
  },
  
  publicDir: 'public',
  
  build: {
    // Optimize for production
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,  // Set to true for debugging production builds
  }
}});
