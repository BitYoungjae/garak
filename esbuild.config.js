import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  outdir: 'dist',
  bundle: true,
  target: 'firefox115',
  format: 'esm',
  platform: 'neutral',
  external: ['gi://*', 'resource://*', 'gettext', 'system', 'cairo'],
  logLevel: 'info',
});
