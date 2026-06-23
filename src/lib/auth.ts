import { cookies } from "next/headers";

const COGNITO_ID_COOKIE_NAME = "__Host-sqlnavi.id";

type CognitoIdTokenPayload = {
  email?: unknown;
  token_use?: unknown;
};

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwtPayload(token: string): CognitoIdTokenPayload | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    return JSON.parse(base64UrlDecode(payload)) as CognitoIdTokenPayload;
  } catch {
    return null;
  }
}

function toDifyUser(email: string) {
  return email.split("@")[0]?.trim() || undefined;
}

export async function getDifyUserFromAuthCookie() {
  const cookieStore = await cookies();
  const idToken = cookieStore.get(COGNITO_ID_COOKIE_NAME)?.value;
  if (!idToken) return undefined;

  const payload = decodeJwtPayload(idToken);
  if (payload?.token_use !== "id" || typeof payload.email !== "string") {
    return undefined;
  }

  return toDifyUser(payload.email);
}
