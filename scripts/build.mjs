/**
 * Build `lib/`. DSH loads `lib/index.js` for the Host and `lib/client.js` for the
 * browser. Both are single-file bundles; `@deepseek-ai/*` stays external because
 * the running Harness provides those packages.
 */
import { build } from 'esbuild'
import { unlinkSync } from 'node:fs'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@deepseek-ai/*'],
  logLevel: 'warning',
})

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.cjs',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  jsx: 'automatic',
  external: ['react', 'react/*', '@deepseek-ai/dsh-client-ui-primitives'],
  logLevel: 'warning',
})

const { writeFileSync } = await import('node:fs')
const { readFileSync } = await import('node:fs')
const source = readFileSync('lib/client.cjs', 'utf8')
writeFileSync('lib/client.js', `window.__ModuleLoader__.load({
	id: "pstack-dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${source}
		return module.exports;
	}
});
`)
try {
  unlinkSync('lib/client.cjs')
} catch {
  // no intermediate artifact
}
console.log('built lib/index.js and lib/client.js')
