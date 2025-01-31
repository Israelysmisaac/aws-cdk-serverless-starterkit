import esbuild from 'esbuild';
import appConfig from './app-config.json';

type Functions = {
    srcFile: string;
    output: string;
};

const handlers = appConfig.functions;

const commonBuildOptions: esbuild.BuildOptions = {
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node20',  // or whichever Node.js version you are using
  treeShaking: true,  // Enable aggressive tree-shaking
  sourcemap: false,
  external: [],  // Add any external dependencies here if needed (e.g., 'aws-sdk' for Lambdas)
};

const buildAll = async (): Promise<void> => {
  try {
    for (const { srcFile, output } of handlers) {
      await esbuild.build({
        entryPoints: [srcFile],
        outfile: output,
        ...commonBuildOptions,
      });
      console.log(`Built ${output}`);
    }
  } catch (error) {
    console.error(error);
  }
};