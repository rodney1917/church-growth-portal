import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const permissionKeys = [
  "dashboard.view", "events.manage", "users.manage", "registrations.view", "registrations.create", "registrations.edit",
  "attendance.check_in", "attendance.reverse", "transport.view", "transport.manage", "transport.board", "souls.view",
  "souls.capture", "followup.view", "followup.assign", "followup.notes", "reports.view", "reports.export", "audit.view",
  "organizations.manage", "journey.view", "journey.manage", "invitations.view", "duplicates.review",
];

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissionKeys,
  ADMIN: permissionKeys,
  REGISTRATION: ["dashboard.view", "registrations.view", "registrations.create", "registrations.edit"],
  CHECK_IN: ["dashboard.view", "registrations.view", "attendance.check_in"],
  TRANSPORT: ["dashboard.view", "registrations.view", "transport.view", "transport.board"],
  SOUL_CAPTURE: ["dashboard.view", "registrations.view", "souls.view", "souls.capture"],
  FOLLOW_UP: ["dashboard.view", "souls.view", "followup.view", "followup.notes"],
  PASTOR: ["dashboard.view","registrations.view","transport.view","souls.view","followup.view","followup.assign","followup.notes","journey.view","journey.manage","invitations.view","reports.view"],
  GROUP_LEADER: ["dashboard.view","registrations.view","transport.view","souls.view","followup.view","journey.view","invitations.view","reports.view"],
  CELL_LEADER: ["dashboard.view","registrations.view","followup.view","followup.notes","journey.view"],
  LEADERSHIP_VIEWER: ["dashboard.view", "registrations.view", "transport.view", "souls.view", "followup.view", "reports.view"],
};

async function main() {
  for (const key of permissionKeys) await db.permission.upsert({ where: { key }, create: { key }, update: {} });
  for (const [name, keys] of Object.entries(rolePermissions)) {
    const role = await db.role.upsert({ where: { name }, create: { name, system: true }, update: {} });
    const permissions = await db.permission.findMany({ where: { key: { in: keys } } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
  }

  const ministry=await db.organization.upsert({where:{code:"MINISTRY"},create:{code:"MINISTRY",name:"Ministry",type:"MINISTRY"},update:{}});
  const church=await db.organization.upsert({where:{code:"MAIN"},create:{code:"MAIN",name:"Main Church",type:"CHURCH",parentId:ministry.id},update:{}});
  const stages=["Salvation","Follow-up","Church Attendance","Foundation School","Baptism","Cell Assignment","Membership","Serving","Established"];
  for(const [position,name] of stages.entries()){const key=name.toUpperCase().replaceAll(" ","_").replaceAll("-","_");await db.journeyStage.upsert({where:{organizationId_key:{organizationId:church.id,key}},create:{organizationId:church.id,key,name,position:position+1},update:{name,position:position+1}})}
  const event = await db.event.upsert({
    where: { code: "NOT1000" },
    create: {
      name: "Night of a Thousand", code: "NOT1000", registrationPrefix: "NOT1000", date: new Date("2026-10-04T00:00:00.000Z"),
      registrationOpen: true, transportEnabled: true, soulCaptureEnabled: true, status: "PUBLISHED", attendanceTarget: 1000, organizationId:church.id,
    },
    update: { organizationId:church.id },
  });
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const admin = await db.user.upsert({
    where: { email },
    create: { email, name: "Portal Administrator", passwordHash: await hash(process.env.SEED_ADMIN_PASSWORD || "ChangeMe-Immediately-2026!", 12) },
    update: {},
  });
  const superAdmin = await db.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  await db.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } }, create: { userId: admin.id, roleId: superAdmin.id }, update: {} });
  await db.userOrganization.upsert({where:{userId_organizationId:{userId:admin.id,organizationId:ministry.id}},create:{userId:admin.id,organizationId:ministry.id,access:"SUBTREE"},update:{access:"SUBTREE"}});
  console.log(`Seeded ${event.name} and administrator ${email}`);
}

main().finally(() => db.$disconnect());
