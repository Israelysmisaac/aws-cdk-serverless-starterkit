const esbuild = require('esbuild');

const handlers = [
  { entry: 'src/lambda-handler/course.ts', outfile: 'dist/course-handler/index.js' },
  { entry: 'src/lambda-handler/connect.ts', outfile: 'dist/connect-handler/index.js' },
  { entry: 'src/lambda-handler/default.ts', outfile: 'dist/default-handler/index.js' },
  { entry: 'src/lambda-handler/disconnect.ts', outfile: 'dist/disconnect-handler/index.js' },
  { entry: 'src/lambda-handler/authorizer.ts', outfile: 'dist/authorizer-handler/index.js' },
//   { entry: 'lambda/test-handler.ts', outfile: 'dist/test-handler.js' },
];

const commonBuildOptions = {
    bundle: true,
    minify: true,
    platform: 'node',
    target: 'node20',  // or whichever Node.js version you are using
    treeShaking: true,  // Enable aggressive tree-shaking
    sourcemap: false,
    external: [],  // Add any external dependencies here if needed (e.g., 'aws-sdk' for Lambdas)
};
  
const buildAll = async () => {
    try {
      for (const { entry, outfile } of [...handlers ]) {
        await esbuild.build({
          entryPoints: [entry],
          outfile: outfile,
          ...commonBuildOptions,
        });
        console.log(`Built ${outfile}`);
      }
    } catch (error) {
      console.error(error);
    }
};
  
buildAll();
