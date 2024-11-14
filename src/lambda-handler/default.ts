import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> => {
    // Logic for message handling
    console.log("default");
    return { statusCode: 200, body: 'Message received' };
  };