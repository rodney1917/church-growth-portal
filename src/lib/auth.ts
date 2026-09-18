import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE = "portal_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export type Session = { userId: string; name: string; permissions: string[] };

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !process.env.AUTH_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireSession(permission?: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (permission && !session.permissions.includes(permission)) redirect("/unauthorized");
  return session;
}

export async function permissionsForUser(userId: string) {
  const rows = await db.rolePermission.findMany({
    where: { role: { users: { some: { userId } } } },
    select: { permission: { select: { key: true } } },
  });
  return [...new Set(rows.map((row) => row.permission.key))];
}
