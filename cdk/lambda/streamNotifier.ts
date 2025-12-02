import { DynamoDBStreamEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: DynamoDBStreamEvent) => {
  const updates = event.Records.map((record) => {
    const newImage = record.dynamodb?.NewImage;
    if (!newImage) {
      return null;
    }

    const item = unmarshall(newImage as Record<string, AttributeValue>);
    return { type: "UPDATE", item };
  }).filter((update) => update !== null);

  if (updates.length === 0) {
    return;
  }

  const connections = await ddb.send(new ScanCommand({ TableName: process.env.CONNECTIONS_TABLE }));

  if (!connections.Items || connections.Items.length === 0) {
    return;
  }

  const apiGw = new ApiGatewayManagementApiClient({
    endpoint: process.env.APIGW_ENDPOINT,
  });
  const payload = JSON.stringify(updates);

  const postTasks = connections.Items.map(async (conn) => {
    try {
      await apiGw.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: payload,
        })
      );
    } catch (e: any) {
      if (e.statusCode === 410) {
        await ddb.send(
          new DeleteCommand({
            TableName: process.env.CONNECTIONS_TABLE,
            Key: { connectionId: conn.connectionId },
          })
        );
      } else {
        console.error("Failed to notify connection", conn.connectionId, e);
      }
    }
  });

  await Promise.all(postTasks);
};
