## websocket-ddb-streams-sample

DynamoDB の更新をトリガーに、API Gateway WebSocket API と Lambda を使ってクライアントに通知するサンプルです。

### 構成

- `cdk/`: インフラ定義（DynamoDB / API Gateway WebSocket API / Lambda）
- `client/`: フロントエンド（React Router v7 + Vite）

### セットアップ

ルートディレクトリで依存関係をインストールします。

```bash
cd cdk
npm install

cd ../client
npm install
```

### デプロイ（CDK）

```bash
cd cdk
npm run cdk -- deploy
```

デプロイ後、スタックの出力に WebSocket のエンドポイント URL（`wss://.../dev`）が表示されます。

### クライアント起動

```bash
cd client
npm run dev
```

ブラウザで表示された URL（通常は `http://localhost:5173/`）にアクセスすると、WebSocket 経由で DynamoDB の更新が反映される Todo 画面を確認できます。

