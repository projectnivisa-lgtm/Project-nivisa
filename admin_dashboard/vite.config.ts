import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  // Vite does not put .env files on process.env, so a value needed by the
  // config itself has to be loaded explicitly. Real environment variables
  // still win, which is what lets Docker override the file.
  const env = loadEnv(mode, process.cwd(), '');

  // The dashboard calls the API through this proxy, so the browser only ever
  // makes same-origin requests and CORS never enters into it. In Docker the
  // target is the api service; on a developer's machine it is localhost, or a
  // deployed API set in .env.local:
  //
  //     VITE_API_PROXY_TARGET=https://staging.thirdeyegfx.in/nivisa
  //
  // A target carrying a path prefix is honoured — the proxy joins it in front
  // of the request path, so /api/v1/admin/orders reaches /nivisa/api/v1/admin/orders.
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000';

  // Inotify events do not cross a Docker bind mount from a Windows host, so
  // without polling the dev server never sees an edit and hot reload silently
  // stops working. Keyed on the real environment variable rather than the
  // resolved target, because only Compose sets it that way - polling is
  // wasteful when running natively, where the native watcher works.
  const inContainer = Boolean(process.env.VITE_API_PROXY_TARGET);

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '0.0.0.0',
      port: 5174,
      watch: inContainer ? { usePolling: true, interval: 300 } : undefined,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        // Uploaded images are served by the API while STORAGE_PROVIDER=local.
        '/media': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
