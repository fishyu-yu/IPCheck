import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { createApp } from './api/app';
import { localAdapter } from './edge/local/adapter';
function edgeApi(): Plugin {
  return {
    name: 'local-edge-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      const app = createApp(localAdapter(env.DEV_PUBLIC_IP));
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/') && req.url !== '/openapi.json') return next();
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            const b = Buffer.from(chunk);
            size += b.length;
            if (size > 2048) {
              res.writeHead(413, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: { code: 'BODY_TOO_LARGE', message: 'Maximum body size is 2 KB' },
                }),
              );
              return;
            }
            chunks.push(b);
          }
          const headers = new Headers();
          Object.entries(req.headers).forEach(([k, v]) => {
            if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
          });
          const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, {
            method: req.method,
            headers,
            ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}),
          });
          const response = await app.fetch(request, env);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.writeHead(500);
          res.end('Local API failed');
        }
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), tailwind(), edgeApi()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: { port: 5173 },
});
