import { relative, resolve, isAbsolute } from 'node:path';

// The official compiler image and Actions runner use different users. Trust only this checkout and its submodules.
export function gitSafetyEnvironment(checkout: string, submodules: string[]): string[] {
  const paths = ['/source', ...submodules.map(path => {
    const child = relative(resolve(checkout), resolve(path));
    if (!child || child === '..' || child.startsWith('../') || child.startsWith('..\\') || isAbsolute(child)) throw new Error('子模組不在來源 checkout 內');
    return `/source/${child.split('\\').join('/')}`;
  })];
  return [`GIT_CONFIG_COUNT=${paths.length}`, ...paths.flatMap((path, i) => [`GIT_CONFIG_KEY_${i}=safe.directory`, `GIT_CONFIG_VALUE_${i}=${path}`])];
}
