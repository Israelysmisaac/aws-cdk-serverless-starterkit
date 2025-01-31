import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dotenv from 'dotenv';
import * as path from 'path';

interface AppConfig {
  appName: string;
  version: string;
  region: string;
  stage: string;
  provider: string;
  envFile: Record<string, string>;
  apiGateway: Array<{
    name: string;
    type: string;
    authenticationType: string;
    cors: string;
  }>;
  functions: Array<{
    name: string;
    runtime: cdk.aws_lambda.Runtime;
    handler: string;
    srcFile: string;
    output: string;
    triggers: Array<{
      type: string;
      endpoint: string;
      method: string;
      responseType: string;
      apiGatewayName: string;
    }>;
    environmentVariable: Record<string, string>;
  }>;
}

type Config = {
  [key: string]: string;
};

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: AppConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    // Load environment variables based on stage
    const envPath = config.envFile[config.stage];
    dotenv.config({ path: path.resolve(__dirname, envPath) });

    // Create Lambda functions
    const functionMap: Record<string, lambda.Function> = {};
    config.functions.forEach((fnConfig) => {
      const environmentVariables = Object.fromEntries(
        Object.entries(fnConfig.environmentVariable).map(([key, value]) => [
          key,
          value.replace('${env.', 'process.env').replace('${currentFunction.name}', fnConfig.name),
        ])
      );

      const lambdaFunction = new lambda.Function(this, fnConfig.name, {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset(path.resolve(__dirname, fnConfig.output).replace("/src/infra/cdk", "").replace("index.js", "") ),
        handler: fnConfig.handler,
        environment: environmentVariables,
      });

      functionMap[fnConfig.name] = lambdaFunction;
    });

    // Create API Gateway and integrate with Lambda functions
    config.apiGateway.forEach((apiConfig) => {
      const api = new apigateway.RestApi(this, apiConfig.name, {
        restApiName: apiConfig.name,
        defaultCorsPreflightOptions: apiConfig.cors
          ? {
              allowOrigins: apigateway.Cors.ALL_ORIGINS,
              allowMethods: apigateway.Cors.ALL_METHODS,
            }
          : undefined,
      });

      config.functions.forEach((fnConfig) => {
        fnConfig.triggers
          .filter((trigger) => trigger.apiGatewayName === apiConfig.name)
          .forEach((trigger) => {
            const lambdaIntegration = new apigateway.LambdaIntegration(functionMap[fnConfig.name], {
              proxy: true,
            });
            
            const resource = api.root.addResource(trigger.endpoint);
            resource.addMethod(trigger.method, lambdaIntegration);
          });
      });
    });

    console.log("done")
  }
  
  interpolateConfig(config: Config, input: string){
    const placeholderRegex = /\${self\.(\w+)}/g;
    let result = input;
    let hasReplacements: boolean;
  
    do {
      hasReplacements = false;
      result = result.replace(placeholderRegex, (match, key) => {
        if (config[key]) {
          hasReplacements = true;
          return config[key];
        }
        return match; // Leave unchanged if key not found
      });
    } while (hasReplacements); // Repeat until no more replacements
    return result;
  };
  
}
