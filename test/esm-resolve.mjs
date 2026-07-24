import { statSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const extensions = ['.js', '.jsx', '.mjs', '.cjs', '.json'];

export function resolve(specifier, context, defaultResolve) {
  if (!specifier.startsWith('.') && !specifier.startsWith('file:')) {
    return defaultResolve(specifier, context, defaultResolve);
  }
  const base = context.parentURL
    ? resolvePath(fileURLToPath(context.parentURL), '..')
    : process.cwd();
  for (const ext of extensions) {
    const p = resolvePath(base, specifier) + ext;
    try {
      statSync(p);
      return { url: pathToFileURL(p).href, shortCircuit: true };
    } catch {}
  }
  const noExt = resolvePath(base, specifier);
  try { statSync(noExt); return { url: pathToFileURL(noExt).href, shortCircuit: true }; } catch {}
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  const result = await defaultLoad(url, context, defaultLoad);
  if (url.includes('/src/')) {
    const patched = result.source.toString()
      .replaceAll('import.meta.env.VITE_API_BASE_URL', 'void 0')
      .replaceAll('import.meta.env', '({ VITE_API_BASE_URL: void 0 })');
    return { ...result, source: patched };
  }
  return result;
}
