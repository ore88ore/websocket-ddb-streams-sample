import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandler = async (event) => {
  const apiGw = new ApiGatewayManagementApiClient({
    endpoint: process.env.APIGW_ENDPOINT,
  });
  const connectionId = event.requestContext.connectionId;

  // 全データ取得
  const result = await ddb.send(
    new ScanCommand({ TableName: process.env.TODO_TABLE })
  );
  const todos = result.Items || [];

  // 要求者のみに返信 (INITタイプとして送信)
  const messageData = JSON.stringify(
    todos.map((item) => ({ type: "INIT", item }))
  );

  if (connectionId) {
    try {
      await apiGw.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: messageData,
        })
      );
    } catch (e) {
      console.error(e);
    }
  }
  return { statusCode: 200, body: "Sent todos" };
};
