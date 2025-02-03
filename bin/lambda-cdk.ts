import { CdkStack } from "../src/infra/cdk/cdk-stack";
import * as cdk from "aws-cdk-lib";
import appConfig from "../app-config.json"
import path from "path";
import * as dotenv from 'dotenv';

function deploy() {
    let stageName:any = "";
    if(process.env.STAGE_NAME){
        stageName = getStageName(process.env.STAGE_NAME)
        appConfig.stage = getStageName(process.env.STAGE_NAME);
    }else{
        stageName = getStageName(appConfig.stage);
    }
    // Load environment variables based on stage
    const envPath = appConfig.envFile[getStageName(stageName)];
    let env = dotenv.config({ path: path.resolve(__dirname, envPath) });
    console.log("env", env.parsed)
    const app = new cdk.App();
    new CdkStack(app, `test-cdk-serverless-${stageName}`,
        appConfig as any,
        {
            stackName: `chatbot-cdk-serverless-${stageName}`,
        })
}

function getStageName(stageValue: string) {
    switch (stageValue) {
        case "local":
            return "local"
            break;
        case "dev":
            return "dev"
            break;
        case "production":
            return "production"
            break;
    
        default:
            return "local"
            break;
    }
}

try {
    deploy()
} catch (error) {
    console.log(error)
}
