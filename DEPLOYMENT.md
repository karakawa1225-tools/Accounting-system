# 本番デプロイ手順（Silverjet 会計システム）

## 前提

- **DB**: [Turso](https://turso.tech/)（libSQL）
- **アプリ**: Next.js 15（Node.js 20+）
- 推奨ホスト: Vercel / 自社 VPS（`npm run build` → `npm run start`）

## 1. Turso データベース

1. Turso でデータベースを作成
2. `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` を控える

## 2. 環境変数

`.env.example` をコピーして本番用に設定します。

| 変数 | 説明 |
|------|------|
| `TURSO_DATABASE_URL` | `libsql://...` または `https://...turso.io` |
| `TURSO_AUTH_TOKEN` | 本番では **必須** |
| `AUTH_SECRET` | 32文字以上のランダム文字列 |
| `SEED_ADMIN_EMAIL` | 初回のみ（管理者メール） |
| `SEED_ADMIN_PASSWORD` | 初回のみ（12文字以上推奨） |

```bash
openssl rand -base64 32
```

## 3. スキーマ適用（初回・マイグレーション追加時）

```bash
npm install
npm run verify:env
npm run db:prod-bootstrap
```

## 4. 管理者ユーザー（初回のみ）

```bash
SEED_ADMIN_EMAIL=your@email.com SEED_ADMIN_PASSWORD='強力なパスワード' npm run db:seed
```

完了後、本番環境から `SEED_ADMIN_PASSWORD` は **削除** してください。

## 5. ビルド・起動

```bash
npm run build
npm run start
```

開発: `npm run dev`

## 6. Vercel にデプロイする場合

1. リポジトリを接続
2. **Environment Variables** に上記をすべて設定（Production）
3. 初回デプロイ前にローカルまたは CI から `npm run db:prod-bootstrap` と `db:seed` を実行
4. デプロイ後: `https://your-app.vercel.app/api/health` が `{"ok":true}` なら DB 接続 OK

## 7. 本番チェックリスト

- [ ] `AUTH_SECRET` は推測困難な値
- [ ] Turso はリモート URL（`file:` ではない）
- [ ] ログイン後、マスタ・売掛・買掛・入出金が動作
- [ ] 区分 CSV（Y始まり）・勘定 CSV（数字コード）を取込
- [ ] 自社設定で会計期間・銀行口座を登録
- [ ] `/api/health` が healthy

## 8. 運用コマンド

| コマンド | 用途 |
|---------|------|
| `npm run db:prod-bootstrap` | マイグレーション + 補完テーブル |
| `npm run db:seed` | 管理者作成・更新 |
| `npm run db:ensure-system-accounts` | 標準勘定の復旧 |
| `npm run db:cleanup-masters` | CSV方針外の区分・勘定整理 |
