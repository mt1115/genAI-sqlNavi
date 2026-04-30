# SQLNavi

Next.js + TypeScript で構築した SQL 支援アプリです。

- SQL作成: Dify Workflow
- SQL解析: Dify Workflow / Chatflow
- テーブル解析: Dify Workflow / Chatflow
- テーブル一覧取得: Dify Knowledge API

## Package Manager

このプロジェクトは `pnpm` を利用します。

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm lint
```

## Environment Variables

`.env.local` に以下を設定します。

```env
DIFY_BASE_URL=https://api.dify.ai/v1

DIFY_API_KEY_SQL_CREATE=app-xxxxxxxxxxxxxxxx
DIFY_API_KEY_SQL=app-xxxxxxxxxxxxxxxx
DIFY_API_KEY_CHAT=app-yyyyyyyyyyyyyyyy
DIFY_API_KEY_SQL_REVIEW=app-zzzzzzzzzzzzzzzz
DIFY_API_KEY_TABLE_SUMMARY=app-aaaaaaaaaaaaaaaa

DIFY_API_KEY_KB=kb-xxxxxxxxxxxxxxxx
DIFY_KB_DATASET_ID=dataset-xxxxxxxxxxxxxxxx

DIFY_WORKFLOW_USER=sqlnavi-user
DIFY_CHAT_USER=sqlnavi-user
```

`.env.example` はコミット対象、`.env.local` はコミット対象外です。

## Main Files

- `src/app/page.tsx`: アプリ本体 UI
- `src/app/admin/page.tsx`: 管理画面 UI
- `src/app/api/sql/generate/route.ts`: SQL生成 API
- `src/app/api/chat/query/route.ts`: SQL解析 / テーブル解析 API
- `src/app/api/tables/route.ts`: テーブル一覧 API
- `src/lib/dify.ts`: Dify API クライアント
- `src/lib/projects.ts`: プロジェクト定義
- `src/lib/admin/`: Excel 正規化 / DDL 生成ロジック
