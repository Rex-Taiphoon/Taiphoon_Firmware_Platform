import { createServer } from 'node:http';
import { createHandler } from './handler.ts';
import type { Environment } from './github.ts';

const handler = createHandler(process.env as unknown as Environment);
const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 131072) { res.writeHead(413); res.end('Request too large'); return; } chunks.push(chunk); }
    const request = new Request(new URL(req.url || '/', process.env.API_ORIGIN), { method: req.method, headers: req.headers as Record<string, string>, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
    const response = await handler(request); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(503); res.end('Service unavailable'); }
}).listen(port, '127.0.0.1', () => console.log(`Local API: http://127.0.0.1:${port}`));
