import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  configFile: false,
  root,
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [
    react(),
    {
      name: 'standalone-without-service-worker',
      resolveId(id) {
        if (id === 'virtual:pwa-register') return '\0standalone-pwa';
      },
      load(id) {
        if (id === '\0standalone-pwa') return 'export function registerSW() {}';
      },
    },
  ],
  build: {
    write: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    lib: { entry: resolve(root, 'src/main.tsx'), name: 'StudyTrace', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
const chunks = outputs.filter(o => o.type === 'chunk');
if (chunks.length !== 1) throw new Error('Expected exactly one standalone script');
const css = outputs.filter(o => o.type === 'asset' && o.fileName.endsWith('.css')).map(o => String(o.source)).join('\n');
const icon = await readFile(resolve(root, 'public/icon.svg'), 'utf8');
const html = `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#234f43"><title>StudyTrace</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>
<body><div id="root"></div><noscript>StudyTraceにはJavaScriptを有効にしてください。</noscript>
<script>${chunks[0].code.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
await writeFile(resolve(root, 'StudyTrace.html'), html, 'utf8');
console.log(`StudyTrace.html created (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB). No external scripts or styles required.`);
