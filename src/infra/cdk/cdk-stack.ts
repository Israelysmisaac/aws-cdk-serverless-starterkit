import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { interpolateConfig } from '../../config';
import * as cognito from 'aws-cdk-lib/aws-cognito';

// Type definitions moved to top for better visibility
type AuthorizerInfo = {
  authorizer: apigateway.IAuthorizer;
  authType: apigateway.AuthorizationType;
};

type AppConfig = {
  appName: string;
  version: string;
  region: string;
  stage: string;
  provider: string;
  envFile: Record<string, string>;
  authorizer: Array<{
    name: string;
    type: string;
    function: any;
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
};

export class CdkStack extends cdk.Stack {
  private functionMap: Record<string, lambda.Function> = {};
  private authorizers: Record<string, AuthorizerInfo> = {};

  constructor(scope: Construct, id: string, config: AppConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    this.createLambdaFunctions(config);
    this.createAuthorizers(config);
    this.createApiGateways(config);

    console.log("Deployment completed successfully");
  }

  private createLambdaFunctions(config: AppConfig): void {
    this.functionMap = config.functions.reduce((acc, fnConfig) => ({
      ...acc,
      [fnConfig.name]: this.createLambdaFunction(config, fnConfig)
    }), {});
  }

  private createLambdaFunction(config: AppConfig, fnConfig: AppConfig['functions'][0]): lambda.Function {
    return new lambda.Function(this, interpolateConfig(config, fnConfig.name), {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset(this.getLambdaAssetPath(fnConfig)),
      handler: fnConfig.handler,
      environment: this.createLambdaEnvironment(config, fnConfig),
    });
  }

  private getLambdaAssetPath(fnConfig: AppConfig['functions'][0]): string {
    return path.resolve(__dirname, fnConfig.output)
      .replace("/src/infra/cdk", "")
      .replace("index.js", "");
  }

  private createLambdaEnvironment(config: AppConfig, fnConfig: AppConfig['functions'][0]): Record<string, string> {
    return Object.fromEntries(
      Object.entries(fnConfig.environmentVariable).map(([key, value]) => [
        key,
        interpolateConfig(config, value.replace('${currentFunction.name}', fnConfig.name)),
      ])
    );
  }

  private createAuthorizers(config: AppConfig): void {
    this.authorizers = config.authorizer.reduce((acc, authConfig) => ({
      ...acc,
      [authConfig.name]: this.createAuthorizer(config, authConfig)
    }), {});
  }

  private createAuthorizer(config: AppConfig, authConfig: AppConfig['authorizer'][0]): AuthorizerInfo {
    switch (authConfig.type) {
      case 'restApi':
        return this.createRestApiAuthorizer(config, authConfig);
      default:
        throw new Error(`Unsupported authorizer type: ${authConfig.type}`);
    }
  }

  private createRestApiAuthorizer(config: AppConfig, authConfig: AppConfig['authorizer'][0]): AuthorizerInfo {
    if (authConfig.name === 'custom-auth') {
      return this.createCustomAuthorizer(config, authConfig);
    }
    if (authConfig.name === 'cognito') {
      return this.createCognitoAuthorizer(config, authConfig);
    }
    throw new Error(`Unknown authorizer type: ${authConfig.name}`);
  }

  private createCustomAuthorizer(config: AppConfig, authConfig: AppConfig['authorizer'][0]): AuthorizerInfo {
    const authFunction = this.createLambdaFunction(config, authConfig.function);
    const authorizer = new apigateway.TokenAuthorizer(this, `TokenAuthorizer-${authConfig.name}`, {
      handler: authFunction,
      identitySource: 'method.request.header.Authorization',
    });

    return {
      authorizer,
      authType: apigateway.AuthorizationType.CUSTOM
    };
  }

  private createCognitoAuthorizer(config: AppConfig, authConfig: AppConfig['authorizer'][0]): AuthorizerInfo {
    const userPoolId = interpolateConfig(config, authConfig.userPool!);
    const userPool = cognito.UserPool.fromUserPoolId(this, `UserPool-${authConfig.name}`, userPoolId);
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, `CognitoAuthorizer-${authConfig.name}`, {
      cognitoUserPools: [userPool],
      identitySource: authConfig.tokenSource!,
    });

    return {
      authorizer,
      authType: apigateway.AuthorizationType.COGNITO
    };
  }

  private createApiGateways(config: AppConfig): void {
    config.apiGateway.forEach(apiConfig => {
      const api = this.createApiGateway(config, apiConfig);
      this.configureApiGatewayEndpoints(config, api, apiConfig);
    });
  }

  private createApiGateway(config: AppConfig, apiConfig: AppConfig['apiGateway'][0]): apigateway.RestApi {
    return new apigateway.RestApi(this, interpolateConfig(config, apiConfig.name), {
      restApiName: interpolateConfig(config, apiConfig.name),
      deploy: true,
      deployOptions: { stageName: config.stage },
      defaultCorsPreflightOptions: this.getCorsOptions(apiConfig)
    });
  }

  private getCorsOptions(apiConfig: AppConfig['apiGateway'][0]): apigateway.CorsOptions | undefined {
    return apiConfig.cors ? {
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
    } : undefined;
  }

  private configureApiGatewayEndpoints(config: AppConfig, api: apigateway.RestApi, apiConfig: AppConfig['apiGateway'][0]): void {
    config.functions.forEach(fnConfig => {
      fnConfig.triggers
        .filter(trigger => trigger.apiGatewayName === apiConfig.name)
        .forEach(trigger => {
          this.configureApiEndpoint(api, fnConfig, trigger);
        });
    });
  }

  private configureApiEndpoint(api: apigateway.RestApi, fnConfig: AppConfig['functions'][0], trigger: AppConfig['functions'][0]['triggers'][0]): void {
    const resource = api.root.addResource(trigger.endpoint);
    const integration = new apigateway.LambdaIntegration(this.functionMap[fnConfig.name], { proxy: true });
    const methodOptions = this.getAuthorizerMethodOptions(fnConfig);

    resource.addMethod(trigger.method, integration, methodOptions);
  }

  private getAuthorizerMethodOptions(fnConfig: AppConfig['functions'][0]): apigateway.MethodOptions | undefined {
    if (!fnConfig.authorizer) return undefined;

    const authorizerInfo = this.authorizers[fnConfig.authorizer];
    return authorizerInfo ? {
      authorizer: authorizerInfo.authorizer,
      authorizationType: authorizerInfo.authType
    } : undefined;
  }
}