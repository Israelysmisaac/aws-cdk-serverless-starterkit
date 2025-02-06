import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> => {
    // Logic for WebSocket connection handling
    console.log("connect");
    return { statusCode: 200, body: 'Connected' };
  };