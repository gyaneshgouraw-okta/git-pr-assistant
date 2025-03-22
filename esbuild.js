const esbuild = require('esbuild');
const { nodeExternalsPlugin } = require('esbuild-node-externals');
const path = require('path');
const fs = require('fs');

// Get command line arguments
const args = process.argv.slice(2);
const watchMode = args.includes('--watch');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Define build options
const buildOptions = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node16',
  outfile: './dist/extension.js',
  external: ['vscode'],
  sourcemap: true,
  plugins: [nodeExternalsPlugin({
    // Force include the AI SDK packages
    allowList: ['ai', '@ai-sdk/amazon-bedrock', '@ai-sdk/provider-utils']
  })],
  logLevel: 'info',
};

// Run build based on mode
if (watchMode) {
  console.log('Running esbuild in watch mode...');
  esbuild.context(buildOptions).then(context => {
    context.watch();
    console.log('Watching for changes...');
  });
} else {
  console.log('Running esbuild...');
  esbuild.build(buildOptions).then(() => {
    console.log('Build complete!');
  }).catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
} 