import { CdkStack } from "../src/infra/cdk/cdk-stack";
import * as cdk from "aws-cdk-lib";
import appConfig from "../app-config.json"

function deploy() {
    const app = new cdk.App();
    new CdkStack(app, `test-cdk-serverless`,
        appConfig as any,
        {
            stackName: `chatbot-cdk-serverless`
        })
}

try {
    deploy()
} catch (error) {
    console.log(error)
}
