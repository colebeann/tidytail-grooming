// Bundles client/ into public/assets/dist with esbuild.
// Everything is self-hosted so the strict CSP (script-src 'self') stays intact.
// Usage: node scripts/build.js [--watch]
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';

const outdir = 'public/assets/dist';
await fs.rm(outdir, { recursive: true, force: true });

const options = {
  entryPoints: ['client/app.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir,
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  legalComments: 'linked',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
  logLevel: 'warning',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching client/ for changes…');
} else {
  const result = await esbuild.build(options);
  const out = Object.entries(result.metafile.outputs)
    .filter(([f]) => f.endsWith('.js'))
    .map(([f, o]) => `${(o.bytes / 1024).toFixed(1).padStart(7)} KB  ${f}`);
  console.log(out.join('\n'));
}
