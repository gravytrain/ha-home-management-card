import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['src/home-management-card.ts'],
  bundle: true,
  outfile: 'dist/home-management-card.js',
  format: 'esm',
  target: 'es2021',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  banner: { js: '/* ha-home-management-card — bundled. Source: src/. */' },
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log('esbuild: watching src/ …');
} else {
  await esbuild.build(options);
  console.log('esbuild: built dist/home-management-card.js');
}
