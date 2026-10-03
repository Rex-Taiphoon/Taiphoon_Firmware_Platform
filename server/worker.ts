import { createHandler } from './handler.ts';
import type { Environment } from './github.ts';
export default { fetch(request: Request, env: Environment) { return createHandler(env)(request); } };
