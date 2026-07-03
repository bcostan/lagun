import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "lagun_session";

function secret() {
  const value = process.env.APP_PASSWORD;
  if (!value) throw new Error("APP_PASSWORD is not set");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ auth: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export function verifyBearer(request: Request): boolean {
  const token = process.env.API_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === token;
}

export async function isAuthorized(request: Request): Promise<boolean> {
  if (verifyBearer(request)) return true;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)lagun_session=([^;]+)/);
  if (!match) return false;
  return verifySessionToken(decodeURIComponent(match[1]));
}

export function checkPassword(password: string): boolean {
  return password === process.env.APP_PASSWORD;
}
