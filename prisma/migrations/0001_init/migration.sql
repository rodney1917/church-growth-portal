-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'CHURCH', 'FRIEND', 'RADIO', 'SMS', 'OTHER', 'STAFF', 'API');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('QR', 'MANUAL', 'API');

-- CreateEnum
CREATE TYPE "BoardingDirection" AS ENUM ('OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('CHILD', 'TEEN', 'YOUNG_ADULT', 'ADULT', 'SENIOR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'NO_ANSWER', 'FOLLOW_UP_REQUIRED', 'FOUNDATION_SCHOOL', 'CELL_ASSIGNED', 'CHURCH_ATTENDING', 'ESTABLISHED');

-- CreateEnum
CREATE TYPE "InteractionChannel" AS ENUM ('PHONE', 'WHATSAPP', 'SMS', 'VISIT', 'CHURCH', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "registrationPrefix" TEXT NOT NULL,
    "registrationSequence" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "venue" TEXT,
    "address" TEXT,
    "description" TEXT,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "transportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "soulCaptureEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "attendanceTarget" INTEGER,
    "soulTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "area" TEXT,
    "gender" "Gender",
    "ageGroup" "AgeGroup" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "qrTokenHash" TEXT NOT NULL,
    "source" "RegistrationSource" NOT NULL,
    "sourceDetail" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "firstTimer" BOOLEAN NOT NULL DEFAULT false,
    "transportRequired" BOOLEAN NOT NULL DEFAULT false,
    "returnTransportRequired" BOOLEAN NOT NULL DEFAULT false,
    "consentUpdates" BOOLEAN NOT NULL DEFAULT false,
    "registeredById" UUID,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInById" UUID,
    "method" "CheckInMethod" NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportPickupPoint" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "routeId" UUID,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "departureTime" TEXT,

    CONSTRAINT "TransportPickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "routeId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TransportVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportAssignment" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "routeId" UUID,
    "pickupPointId" UUID,
    "vehicleId" UUID,
    "seatsRequired" INTEGER NOT NULL DEFAULT 1,
    "capacityOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportBoarding" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "direction" "BoardingDirection" NOT NULL,
    "boardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boardedById" UUID,
    "method" "CheckInMethod" NOT NULL,

    CONSTRAINT "TransportBoarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalvationDecision" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "registrationId" UUID,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workerId" UUID,
    "notes" TEXT,

    CONSTRAINT "SalvationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpAssignment" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "registrationId" UUID,
    "salvationDecisionId" UUID,
    "assignedWorkerId" UUID,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'NEW',
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpInteraction" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "channel" "InteractionChannel" NOT NULL,
    "notes" TEXT NOT NULL,
    "outcome" TEXT,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Event_code_key" ON "Event"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Event_registrationPrefix_key" ON "Event"("registrationPrefix");

-- CreateIndex
CREATE INDEX "Event_date_status_idx" ON "Event"("date", "status");

-- CreateIndex
CREATE INDEX "Person_fullName_idx" ON "Person"("fullName");

-- CreateIndex
CREATE INDEX "Person_area_idx" ON "Person"("area");

-- CreateIndex
CREATE UNIQUE INDEX "people_normalized_phone_unique" ON "Person"("normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_registrationNumber_key" ON "EventRegistration"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_qrTokenHash_key" ON "EventRegistration"("qrTokenHash");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_registeredAt_idx" ON "EventRegistration"("eventId", "registeredAt");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_firstTimer_idx" ON "EventRegistration"("eventId", "firstTimer");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_transportRequired_idx" ON "EventRegistration"("eventId", "transportRequired");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_personId_key" ON "EventRegistration"("eventId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_registrationId_key" ON "Attendance"("registrationId");

-- CreateIndex
CREATE INDEX "Attendance_eventId_checkedInAt_idx" ON "Attendance"("eventId", "checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_eventId_code_key" ON "TransportRoute"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TransportPickupPoint_eventId_name_key" ON "TransportPickupPoint"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_eventId_code_key" ON "TransportVehicle"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TransportAssignment_registrationId_key" ON "TransportAssignment"("registrationId");

-- CreateIndex
CREATE INDEX "TransportAssignment_vehicleId_idx" ON "TransportAssignment"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportBoarding_registrationId_direction_key" ON "TransportBoarding"("registrationId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "SalvationDecision_registrationId_key" ON "SalvationDecision"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "SalvationDecision_eventId_personId_key" ON "SalvationDecision"("eventId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpAssignment_salvationDecisionId_key" ON "FollowUpAssignment"("salvationDecisionId");

-- CreateIndex
CREATE INDEX "FollowUpAssignment_assignedWorkerId_status_idx" ON "FollowUpAssignment"("assignedWorkerId", "status");

-- CreateIndex
CREATE INDEX "FollowUpAssignment_nextFollowUpAt_idx" ON "FollowUpAssignment"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_provider_status_createdAt_idx" ON "IntegrationEvent"("provider", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportPickupPoint" ADD CONSTRAINT "TransportPickupPoint_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportPickupPoint" ADD CONSTRAINT "TransportPickupPoint_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVehicle" ADD CONSTRAINT "TransportVehicle_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVehicle" ADD CONSTRAINT "TransportVehicle_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "TransportPickupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportBoarding" ADD CONSTRAINT "TransportBoarding_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportBoarding" ADD CONSTRAINT "TransportBoarding_boardedById_fkey" FOREIGN KEY ("boardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalvationDecision" ADD CONSTRAINT "SalvationDecision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalvationDecision" ADD CONSTRAINT "SalvationDecision_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalvationDecision" ADD CONSTRAINT "SalvationDecision_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalvationDecision" ADD CONSTRAINT "SalvationDecision_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssignment" ADD CONSTRAINT "FollowUpAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssignment" ADD CONSTRAINT "FollowUpAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssignment" ADD CONSTRAINT "FollowUpAssignment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssignment" ADD CONSTRAINT "FollowUpAssignment_salvationDecisionId_fkey" FOREIGN KEY ("salvationDecisionId") REFERENCES "SalvationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpAssignment" ADD CONSTRAINT "FollowUpAssignment_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpInteraction" ADD CONSTRAINT "FollowUpInteraction_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "FollowUpAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpInteraction" ADD CONSTRAINT "FollowUpInteraction_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
