import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { interpolateConfig } from '../../config';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as agwa from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

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
  websocketApi?: Array<{
    name: string;
    routeSelectionExpression?: string;
    stageName?: string;
  }>;
  functions: Array<{
    name: string;
    runtime: cdk.aws_lambda.Runtime;
    handler: string;
    srcFile: string;
    output: string;
    memory?: number;
    concurrency?: number;
    timeout?: number;
    layers?: string[];
    triggers: Array<{
      type: string;
      endpoint: string;
      method: string;
      responseType: string;
      apiGatewayName: string;
      authorizer?: string;
      bucketName?: string;
      bucketEvents?: Array<Record<string, string>>;
      scheduleExpression?: string;
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
    this.createWebSocketApis(config);
    this.configureSchedulerTriggers(config);
    // this.configureS3Events(config)

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
      layers: this.createLayers(config, fnConfig)
    });
  }

  private createLayers(config: AppConfig, fnConfig: AppConfig['functions'][0]): lambda.ILayerVersion[] | undefined{
    const layers = fnConfig.layers?.map((layerArn, index) => {
      const interpolatedArn = interpolateConfig(config, layerArn);
      return lambda.LayerVersion.fromLayerVersionArn(
        this,
        `${fnConfig.name}Layer${index}`, // Unique ID for each layer
        interpolatedArn
      );
    });
    return layers;
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

  private createAuthorizer(config: AppConfig, authConfig: AppConfig['authorizer'][0]): AuthorizerInfo | cdk.aws_apigatewayv2_authorizers.WebSocketLambdaAuthorizer {
    switch (authConfig.type) {
      case 'restApi':
        return this.createRestApiAuthorizer(config, authConfig);
      case 'websocket':
        return this.createWebsocketAuthorizer(config, authConfig);
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

  private createWebsocketAuthorizer(config: AppConfig, authConfig: AppConfig['authorizer'][0]): cdk.aws_apigatewayv2_authorizers.WebSocketLambdaAuthorizer {
    if (authConfig.name === 'custom-auth') {
      const authFunction = this.createLambdaFunction(config, authConfig.function);
      const authorizer = new agwa.WebSocketLambdaAuthorizer(
        "Authorizer",
        authFunction,
        {
          identitySource: [`route.request.querystring.key`],
        }
      );
      return authorizer;
    }
    throw new Error(`Unknown authorizer type: ${authConfig.name}`);
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
    const methodOptions = this.getAuthorizerMethodOptions(trigger);

    resource.addMethod(trigger.method, integration, methodOptions);
  }

  private getAuthorizerMethodOptions(trigger: AppConfig['functions'][0]['triggers'][0]): apigateway.MethodOptions | undefined {
    if (!trigger.authorizer) return undefined;

    const authorizerInfo = this.authorizers[trigger.authorizer];
    return authorizerInfo ? {
      authorizer: authorizerInfo.authorizer,
      authorizationType: authorizerInfo.authType
    } : undefined;
  }

  private createWebSocketApis(config: AppConfig): void {
    // Only proceed if websocketApi configuration exists.
    if (!config.websocketApi || config.websocketApi.length === 0) return;

    // For each websocketApi config object, create a WebSocket API, its stage, and configure its routes.
    config.websocketApi.forEach(wsConfig => {
      // Use the provided name, route selection expression, and stageName (or fallback to config.stage).
      const wsApi = new apigwv2.WebSocketApi(this, interpolateConfig(config, wsConfig.name), {
        routeSelectionExpression: wsConfig.routeSelectionExpression || '$request.body.action'
      });

      new apigwv2.WebSocketStage(this, `${wsConfig.name}-Stage`, {
        webSocketApi: wsApi,
        stageName: interpolateConfig(config, wsConfig.stageName || config.stage),
        autoDeploy: true,
      });

      // Add routes for all functions with a "websocket" trigger.
      this.configureWebSocketRoutes(config, wsApi);
    });
  }

  private configureWebSocketRoutes(config: AppConfig, wsApi: apigwv2.WebSocketApi): void {
    config.functions.forEach(fnConfig => {
      fnConfig.triggers
        .filter(trigger => trigger.type === "websocket")
        .forEach(trigger => {
          // Create a Lambda integration for the WebSocket function.
          const lambdaFunction = this.functionMap[fnConfig.name];
          const integration = new integrations.WebSocketLambdaIntegration(
            interpolateConfig(config, fnConfig.name),
            lambdaFunction
          );
          if(trigger.authorizer){
            const authorizerInfo = this.authorizers[trigger.authorizer];
            // The trigger's "endpoint" is used as the route key.
            wsApi.addRoute(trigger.endpoint, {
              integration: integration,
              authorizer: authorizerInfo.authorizer as unknown as apigwv2.IWebSocketRouteAuthorizer
            });
          }else{
            // The trigger's "endpoint" is used as the route key.
            wsApi.addRoute(trigger.endpoint, {
              integration: integration
            });
          }
          
        });
    });
  }

  private configureS3Events(config: AppConfig): void {
    config.functions.forEach(fnConfig => {
      fnConfig.triggers
        .filter(trigger => trigger.type === "s3event")
        .forEach(trigger => {
          if(trigger.bucketName){
            this.addS3BucketTrigger(trigger.bucketName, fnConfig.name)
          }
        })
    })
  }

  private addS3BucketTrigger(bucketName: string, functionName: string){
    // Reference existing S3 bucket
    const bucket = s3.Bucket.fromBucketName(this, 'PhotosBucket', bucketName);
    const lambdaFunction = this.functionMap[functionName];
    // Add S3 event notification with filters
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(lambdaFunction),
      {
        prefix: 'uploads/',
        suffix: '.jpg'
      }
    );

    // Grant S3 permissions to invoke Lambda (required when using imported bucket)
    lambdaFunction.addPermission('AllowS3Invocation', {
      principal: new iam.ServicePrincipal('s3.amazonaws.com'),
      sourceArn: bucket.bucketArn
    });
  }

  private configureSchedulerTriggers(config: AppConfig): void {
    config.functions.forEach(fnConfig => {
      fnConfig.triggers
        .filter(trigger => trigger.type === 'scheduler')
        .forEach(trigger => {
          this.createSchedulerTrigger(config, fnConfig.name, trigger);
        });
    });
  }

  private createSchedulerTrigger(config: AppConfig, functionName: string, trigger: any): void {
    const lambdaFunction = this.functionMap[functionName];
    if (!trigger.scheduleExpression) {
      throw new Error(`Schedule expression is required for scheduler trigger in function ${functionName}`);
    }
    const interpolatedSchedule = interpolateConfig(config, trigger.scheduleExpression);
    
    const rule = new events.Rule(this, `SchedulerRule-${functionName}-${interpolatedSchedule}`, {
      schedule: events.Schedule.expression(interpolatedSchedule),
    });
    
    rule.addTarget(new targets.LambdaFunction(lambdaFunction));
  }
}