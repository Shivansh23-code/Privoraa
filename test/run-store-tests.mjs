import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./test/esm-resolve.mjs', pathToFileURL('./'));

globalThis.localStorage = new Proxy(new Map(), {
  get(target, prop) {
    if (prop === 'getItem') return (k) => target.get(k) ?? null;
    if (prop === 'setItem') return (k, v) => target.set(k, String(v));
    if (prop === 'removeItem') return (k) => target.delete(k);
    if (prop === 'clear') return () => target.clear();
    return target[prop];
  },
});

// Inject test script path as argument
const testPath = process.argv[2];
if (!testPath) {
  console.error('Usage: node test/run-store-tests.mjs <test-file>');
  process.exit(1);
}
import(pathToFileURL(testPath).href).catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
