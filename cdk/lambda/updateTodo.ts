import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const { id, title, status } = body.data || {};

  const todoItem = {
    id: id || randomUUID(),
    title: title || "No Title",
    status: status || "pending",
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: process.env.TODO_TABLE,
      Item: todoItem,
    })
  );

  return { statusCode: 200, body: "Updated" };
};
