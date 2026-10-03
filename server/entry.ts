import { createHandler } from './handler.ts';
import type { Environment } from './github.ts';
export { createHandler };
// Provider adapter supplies Web Request/Response and server-side environment secrets.
export default async function handle(request: Request, env: Environment = process.env as unknown as Environment): Promise<Response> {
  return createHandler(env)(request);
}
