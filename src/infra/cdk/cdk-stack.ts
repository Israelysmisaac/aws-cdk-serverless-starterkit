import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { interpolateConfig } from '../../config';
import * as cognito from 'aws-cdk-lib/aws-cognito';
// import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface AppConfig {
  appName: string;
  version: string;
  region: string;
  stage: string;
  provider: string;
  envFile: Record<string, string>;
  authorizer: Array<{
    name: string;
    type: string;
    authFunctionName?: string;
    userPool?: string;
    tokenSource?: string;
  }>;
  vpc: Array<{ name: string }>;
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
    authorizer?: string;
    memory?: number;
    concurrency?: number;
    timeout?: number;
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

type AuthorizerInfo = {
  authorizer: apigateway.IAuthorizer;
  authType: apigateway.AuthorizationType;
};

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: AppConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    // Look up the VPC
    // const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
    //   vpcName: config.vpc[0].name,
    // });

    // Create Lambda functions
    const functionMap: Record<string, lambda.Function> = {};
    config.functions.forEach((fnConfig) => {
      const environmentVariables = Object.fromEntries(
        Object.entries(fnConfig.environmentVariable).map(([key, value]) => [
          key,
          interpolateConfig(config , value.replace('${currentFunction.name}', fnConfig.name)),
        ])
      );

      const lambdaFunction = new lambda.Function(this, interpolateConfig(config, fnConfig.name), {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset(path.resolve(__dirname, fnConfig.output).replace("/src/infra/cdk", "").replace("index.js", "") ),
        handler: fnConfig.handler,
        environment: environmentVariables,
        // vpc: vpc,
        // vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      });

      functionMap[fnConfig.name] = lambdaFunction;
    });

    // Create authorizers
    const authorizers: Record<string, AuthorizerInfo> = {};
    config.authorizer.forEach(authConfig => {
      const authName = authConfig.name;
      if (authConfig.type === 'restApi') {
        if (authName === 'custom-auth' && authConfig.authFunctionName) {
          const authFunctionName = interpolateConfig(config, authConfig.authFunctionName);
          const authLambda = lambda.Function.fromFunctionName(this, `AuthLambda-${authName}`, authFunctionName);
          const authorizer = new apigateway.TokenAuthorizer(this, `TokenAuthorizer-${authName}`, {
            handler: authLambda,
            identitySource: 'method.request.header.Authorization',
          });
          authorizers[authName] = {
            authorizer: authorizer,
            authType: apigateway.AuthorizationType.CUSTOM,
          };
        } else if (authName === 'cognito' && authConfig.userPool && authConfig.tokenSource) {
          const userPoolId = interpolateConfig(config, authConfig.userPool);
          const userPool = cognito.UserPool.fromUserPoolId(this, `UserPool-${authName}`, userPoolId);
          const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, `CognitoAuthorizer-${authName}`, {
            cognitoUserPools: [userPool],
            identitySource: authConfig.tokenSource,
          });
          authorizers[authName] = {
            authorizer: cognitoAuthorizer,
            authType: apigateway.AuthorizationType.COGNITO,
          };
        }
      }
    });

    // Create API Gateway and integrate with Lambda functions
    config.apiGateway.forEach((apiConfig) => {
      const api = new apigateway.RestApi(this, interpolateConfig(config, apiConfig.name), {
        restApiName: interpolateConfig(config, apiConfig.name),
        deploy: true,
        deployOptions: {
          stageName: config.stage,  // Use stage from config
        },
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

            let methodOptions: any = {};
            if (fnConfig.authorizer) {
              const authorizerInfo = authorizers[fnConfig.authorizer];
              if (authorizerInfo) {
                methodOptions.authorizer = authorizerInfo.authorizer;
                methodOptions.authorizationType = authorizerInfo.authType;
              }
            } else {
              methodOptions.authorizationType = apigateway.AuthorizationType.NONE;
            }

            resource.addMethod(trigger.method, lambdaIntegration, methodOptions);
          });
      });
    });

    console.log("done")
  }
  
}
