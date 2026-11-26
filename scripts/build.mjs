/**
 * Build `harness/pstack/dsh/dist/`. DSH loads `harness/pstack/dsh/dist/index.js` for the Host and `harness/pstack/dsh/dist/client.js` for the
 * browser. Both are single-file bundles; `@deepseek-ai/*` stays external because
 * the running Harness provides those packages.
 */
import { build } from 'esbuild'
import { unlinkSync } from 'node:fs'

await build({
  entryPoints: ['harness/pstack/dsh/src/index.ts'],
  outfile: 'harness/pstack/dsh/dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@deepseek-ai/*'],
  logLevel: 'warning',
})

await build({
  entryPoints: ['harness/pstack/dsh/src/client/index.tsx'],
  outfile: 'harness/pstack/dsh/dist/client.cjs',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  jsx: 'automatic',
  external: ['react', 'react/*', '@deepseek-ai/dsh-client-ui-primitives'],
  logLevel: 'warning',
})

const { writeFileSync } = await import('node:fs')
const { readFileSync } = await import('node:fs')
const source = readFileSync('harness/pstack/dsh/dist/client.cjs', 'utf8')
writeFileSync('harness/pstack/dsh/dist/client.js', `window.__ModuleLoader__.load({
	id: "dsh-pstack",
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
  unlinkSync('harness/pstack/dsh/dist/client.cjs')
} catch {
  // no intermediate artifact
}
console.log('built harness/pstack/dsh/dist/index.js and harness/pstack/dsh/dist/client.js')
