import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as agwa from "aws-cdk-lib/aws-apigatewayv2-authorizers";
// import * as iam from 'aws-cdk-lib/aws-iam';

export class LambdaCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: any) {
    super(scope, id, props);

    const myLambdaFunction = new lambda.Function(this, 'course-handler-cdk', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset("../../dist/course-handler/"),
    });

    const connectFunction = new lambda.Function(this, 'connect-handler-cdk', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset("../../dist/connect-handler/"),
    });



    const defaultFunction = new lambda.Function(this, 'default-handler-cdk', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset("../../dist/default-handler/"),
    });

    const disconnectFunction = new lambda.Function(this, 'disconnect-handler-cdk', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset("../../dist/disconnect-handler/"),
    });

    const authorizerFunction = new lambda.Function(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../../dist/authorizer-handler/'),  // Assume the authorizer code is in 'lib/lambda/authorizer.ts'
    });

    const api = new apigateway.RestApi(this, 'MyApiCdk', {
      restApiName: 'My Lambda API',
      description: 'API Gateway with Lambda and Authorizer',
    });

    const myLambdaIntegration = new apigateway.LambdaIntegration(myLambdaFunction);

    const lambdaResource = api.root.addResource('myhello');
    lambdaResource.addMethod('GET', myLambdaIntegration);

    const authorizer = new agwa.WebSocketLambdaAuthorizer("Authorizer", authorizerFunction, {
      identitySource: [`route.request.querystring.${props.querystringKeyForIdToken ?? "key"}`],
    });

    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'mywsapi');

    webSocketApi.addRoute('$connect', {
      integration: new WebSocketLambdaIntegration('ConnectIntegration', connectFunction),
      authorizer
    });

    webSocketApi.addRoute('$disconnect', {
      integration: new WebSocketLambdaIntegration('DisconnectIntegration', disconnectFunction),
    });

    webSocketApi.addRoute('$default', {
      integration: new WebSocketLambdaIntegration('DefaultIntegration', defaultFunction),
    });

    // API Gateway WebSocket Stage
    new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi,
      stageName: 'dev',
      autoDeploy: true,
    });
  }
}
