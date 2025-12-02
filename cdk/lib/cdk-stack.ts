import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as path from "path";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- DynamoDB ---
    const connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      partitionKey: {
        name: "connectionId",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const todoTable = new dynamodb.Table(this, "TodoTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // --- WebSocket API ---
    const webSocketApi = new apigwv2.WebSocketApi(this, "TodoWebSocketApi");
    const apiStage = new apigwv2.WebSocketStage(this, "DevStage", {
      webSocketApi,
      stageName: "dev",
      autoDeploy: true,
    });

    // --- Lambda 共通設定 ---
    const commonProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      bundling: { minify: true, sourceMap: true },
    };

    // 1. Connect
    const connectHandler = new nodejs.NodejsFunction(this, "ConnectHandler", {
      entry: path.join(__dirname, "../lambda/connect.ts"),
      environment: { CONNECTIONS_TABLE: connectionsTable.tableName },
      ...commonProps,
    });
    connectionsTable.grantWriteData(connectHandler);
    webSocketApi.addRoute("$connect", {
      integration: new apigwv2_integrations.WebSocketLambdaIntegration(
        "ConnectIntegration",
        connectHandler
      ),
    });

    // 2. Disconnect
    const disconnectHandler = new nodejs.NodejsFunction(
      this,
      "DisconnectHandler",
      {
        entry: path.join(__dirname, "../lambda/disconnect.ts"),
        environment: { CONNECTIONS_TABLE: connectionsTable.tableName },
        ...commonProps,
      }
    );
    connectionsTable.grantWriteData(disconnectHandler);
    webSocketApi.addRoute("$disconnect", {
      integration: new apigwv2_integrations.WebSocketLambdaIntegration(
        "DisconnectIntegration",
        disconnectHandler
      ),
    });

    // 3. GetTodos (初期データ取得)
    const getTodosHandler = new nodejs.NodejsFunction(this, "GetTodosHandler", {
      entry: path.join(__dirname, "../lambda/getTodos.ts"),
      environment: {
        TODO_TABLE: todoTable.tableName,
        APIGW_ENDPOINT: apiStage.callbackUrl,
      },
      ...commonProps,
    });
    todoTable.grantReadData(getTodosHandler);
    webSocketApi.grantManageConnections(getTodosHandler);
    webSocketApi.addRoute("getTodos", {
      integration: new apigwv2_integrations.WebSocketLambdaIntegration(
        "GetTodosIntegration",
        getTodosHandler
      ),
    });

    // 4. UpdateTodo (更新＆通知)
    const updateTodoHandler = new nodejs.NodejsFunction(
      this,
      "UpdateTodoHandler",
      {
        entry: path.join(__dirname, "../lambda/updateTodo.ts"),
        environment: {
          TODO_TABLE: todoTable.tableName,
        },
        ...commonProps,
      }
    );
    todoTable.grantWriteData(updateTodoHandler);
    webSocketApi.addRoute("updateTodo", {
      integration: new apigwv2_integrations.WebSocketLambdaIntegration(
        "UpdateIntegration",
        updateTodoHandler
      ),
    });

    // 5. DynamoDB Streams Notifier
    const todoStreamNotifier = new nodejs.NodejsFunction(
      this,
      "TodoStreamNotifier",
      {
        entry: path.join(__dirname, "../lambda/streamNotifier.ts"),
        environment: {
          CONNECTIONS_TABLE: connectionsTable.tableName,
          APIGW_ENDPOINT: apiStage.callbackUrl,
        },
        ...commonProps,
      }
    );
    connectionsTable.grantReadData(todoStreamNotifier);
    connectionsTable.grantWriteData(todoStreamNotifier);
    webSocketApi.grantManageConnections(todoStreamNotifier);
    todoTable.grantStreamRead(todoStreamNotifier);
    todoStreamNotifier.addEventSource(
      new lambdaEventSources.DynamoEventSource(todoTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
      })
    );

    // --- Output ---
    new cdk.CfnOutput(this, "WebSocketURL", { value: apiStage.url });
  }
}
