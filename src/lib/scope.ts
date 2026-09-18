import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function organizationScope(permission: string) {
  const session = await requireSession(permission);
  const roles = await db.userRole.findMany({ where: { userId: session.userId }, select: { role: { select: { name: true } } } });
  if (roles.some((row) => row.role.name === "SUPER_ADMIN")) return { session, unrestricted: true, organizationIds: [] as string[] };
  const grants = await db.userOrganization.findMany({ where: { userId: session.userId } });
  const ids = new Set(grants.map((grant) => grant.organizationId));
  let frontier = grants.filter((grant) => grant.access === "SUBTREE").map((grant) => grant.organizationId);
  while (frontier.length) {
    const children = await db.organization.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((child) => child.id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }
  return { session, unrestricted: false, organizationIds: [...ids] };
}

export async function assertOrganizationAccess(permission: string, organizationId: string | null) {
  const scope = await organizationScope(permission);
  if (scope.unrestricted || (organizationId && scope.organizationIds.includes(organizationId))) return scope.session;
  throw new Error("You do not have access to this organization.");
}
