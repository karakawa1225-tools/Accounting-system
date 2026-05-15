/**
 * 本番・開発で必須の環境変数。サーバー起動時に検証する。
 */
export type ServerEnv = {
  tursoDatabaseUrl: string;
  tursoAuthToken: string | undefined;
  authSecret: string;
  nodeEnv: "development" | "production" | "test";
  appUrl: string | undefined;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getServerEnv(): ServerEnv {
  const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL?.trim() ?? "";
  const authSecret = process.env.AUTH_SECRET?.trim() ?? "";
  const nodeEnv = (process.env.NODE_ENV ?? "development") as ServerEnv["nodeEnv"];

  return {
    tursoDatabaseUrl,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    authSecret,
    nodeEnv,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined,
  };
}

/** サーバー起動時に呼ぶ。不足があれば即座に失敗する。 */
export function validateServerEnv(): ServerEnv {
  const env = getServerEnv();
  const missing: string[] = [];

  if (!env.tursoDatabaseUrl) missing.push("TURSO_DATABASE_URL");
  if (!env.authSecret) missing.push("AUTH_SECRET");
  if (env.authSecret && env.authSecret.length < 32) {
    throw new Error("AUTH_SECRET は32文字以上にしてください（openssl rand -base64 32 など）");
  }

  if (isProduction()) {
    if (!env.tursoAuthToken) missing.push("TURSO_AUTH_TOKEN（本番の Turso では必須）");
    if (env.tursoDatabaseUrl.startsWith("file:")) {
      throw new Error("本番では file: のローカル DB は使えません。Turso のリモート URL を設定してください。");
    }
    if (process.env.SEED_ADMIN_PASSWORD) {
      console.warn("[env] 本番で SEED_ADMIN_PASSWORD が設定されています。初回 seed 後は削除を推奨します。");
    }
  }

  if (missing.length) {
    throw new Error(`必須の環境変数が未設定です: ${missing.join(", ")}\n.env.example を参照してください。`);
  }

  return env;
}
