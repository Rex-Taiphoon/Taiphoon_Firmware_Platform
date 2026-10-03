import { build } from 'esbuild';
await build({ entryPoints: ['server/entry.ts'], outfile: 'dist-api/handler.js', bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: false });
