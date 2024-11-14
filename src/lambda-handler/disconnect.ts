import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> => {
    // Logic for WebSocket disconnection handling
    console.log("disconnect");
    return { statusCode: 200, body: 'Disconnected' };
  };