-- Phase 2 is additive. Existing people, registrations and event-day records are preserved.
ALTER TYPE "RegistrationSource" ADD VALUE IF NOT EXISTS 'SELF_WEB';
ALTER TYPE "RegistrationSource" ADD VALUE IF NOT EXISTS 'STAFF_CAPTURE';
ALTER TYPE "RegistrationSource" ADD VALUE IF NOT EXISTS 'IMPORT';
ALTER TYPE "RegistrationSource" ADD VALUE IF NOT EXISTS 'EVENT_DAY';
CREATE TYPE "OrganizationType" AS ENUM ('MINISTRY','ZONE','GROUP','CHURCH','CELL','OTHER');
CREATE TYPE "OrganizationAccess" AS ENUM ('OWN','SUBTREE');
CREATE TYPE "ContactType" AS ENUM ('PHONE','WHATSAPP','EMAIL','OTHER');
CREATE TYPE "RelationshipType" AS ENUM ('SELF','MOTHER','FATHER','SPOUSE','BROTHER','SISTER','GUARDIAN','FRIEND','CHURCH_WORKER','OTHER');
CREATE TYPE "DuplicateReviewStatus" AS ENUM ('PENDING','DISTINCT','MERGED','DISMISSED');
CREATE TYPE "JourneyStatus" AS ENUM ('NOT_STARTED','IN_PROGRESS','SCHEDULED','COMPLETED','PAUSED');
CREATE TYPE "InvitationChannel" AS ENUM ('WEB','WHATSAPP','SMS','STAFF','EVENT_DAY','OTHER');
CREATE TYPE "InvitationStatus" AS ENUM ('CREATED','QUEUED','SENT','DELIVERED','OPENED','REGISTERED','DECLINED','OPTED_OUT','FAILED');

DROP INDEX IF EXISTS "people_normalized_phone_unique";
ALTER TABLE "Person" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Person" ALTER COLUMN "normalizedPhone" DROP NOT NULL;
CREATE INDEX "Person_normalizedPhone_idx" ON "Person"("normalizedPhone");
ALTER TABLE "Event" ADD COLUMN "organizationId" UUID;
ALTER TABLE "Attendance" ADD COLUMN "deviceId" TEXT;

CREATE TABLE "Organization" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"parentId" UUID,"type" "OrganizationType" NOT NULL,"name" TEXT NOT NULL,"code" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Organization_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");
CREATE INDEX "Organization_parentId_type_idx" ON "Organization"("parentId","type");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserOrganization" ("userId" UUID NOT NULL,"organizationId" UUID NOT NULL,"access" "OrganizationAccess" NOT NULL DEFAULT 'OWN',CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("userId","organizationId"));
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PersonOrganization" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"personId" UUID NOT NULL,"organizationId" UUID NOT NULL,"roleLabel" TEXT,"isPrimary" BOOLEAN NOT NULL DEFAULT false,"startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"endedAt" TIMESTAMP(3),CONSTRAINT "PersonOrganization_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PersonOrganization_personId_isPrimary_idx" ON "PersonOrganization"("personId","isPrimary");
CREATE INDEX "PersonOrganization_organizationId_endedAt_idx" ON "PersonOrganization"("organizationId","endedAt");
ALTER TABLE "PersonOrganization" ADD CONSTRAINT "PersonOrganization_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonOrganization" ADD CONSTRAINT "PersonOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PersonContact" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"personId" UUID NOT NULL,"type" "ContactType" NOT NULL DEFAULT 'PHONE',"value" TEXT NOT NULL,"normalizedValue" TEXT,"contactPerson" TEXT,"relationship" "RelationshipType" NOT NULL DEFAULT 'SELF',"isPrimary" BOOLEAN NOT NULL DEFAULT false,"consentUpdates" BOOLEAN NOT NULL DEFAULT false,"optedOutAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "PersonContact_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PersonContact_normalizedValue_idx" ON "PersonContact"("normalizedValue");
CREATE INDEX "PersonContact_personId_isPrimary_idx" ON "PersonContact"("personId","isPrimary");
ALTER TABLE "PersonContact" ADD CONSTRAINT "PersonContact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "PersonContact" ("personId","value","normalizedValue","relationship","isPrimary","updatedAt") SELECT "id","phone","normalizedPhone",'SELF',true,CURRENT_TIMESTAMP FROM "Person" WHERE "phone" IS NOT NULL;

CREATE TABLE "PossibleDuplicate" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"personId" UUID NOT NULL,"candidateId" UUID NOT NULL,"reason" TEXT NOT NULL,"score" INTEGER,"status" "DuplicateReviewStatus" NOT NULL DEFAULT 'PENDING',"reviewedById" UUID,"reviewedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "PossibleDuplicate_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PossibleDuplicate_personId_candidateId_key" ON "PossibleDuplicate"("personId","candidateId");
CREATE INDEX "PossibleDuplicate_status_createdAt_idx" ON "PossibleDuplicate"("status","createdAt");
ALTER TABLE "PossibleDuplicate" ADD CONSTRAINT "PossibleDuplicate_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PossibleDuplicate" ADD CONSTRAINT "PossibleDuplicate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JourneyStage" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"organizationId" UUID,"key" TEXT NOT NULL,"name" TEXT NOT NULL,"position" INTEGER NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "JourneyStage_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "JourneyStage_organizationId_key_key" ON "JourneyStage"("organizationId","key");
CREATE INDEX "JourneyStage_organizationId_position_idx" ON "JourneyStage"("organizationId","position");
ALTER TABLE "JourneyStage" ADD CONSTRAINT "JourneyStage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PersonJourney" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"personId" UUID NOT NULL,"organizationId" UUID,"stageId" UUID NOT NULL,"eventId" UUID,"status" "JourneyStatus" NOT NULL,"effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"workerId" UUID,"location" TEXT,"notes" TEXT,"metadata" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "PersonJourney_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PersonJourney_personId_stageId_effectiveDate_idx" ON "PersonJourney"("personId","stageId","effectiveDate");
CREATE INDEX "PersonJourney_organizationId_stageId_status_idx" ON "PersonJourney"("organizationId","stageId","status");
ALTER TABLE "PersonJourney" ADD CONSTRAINT "PersonJourney_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonJourney" ADD CONSTRAINT "PersonJourney_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonJourney" ADD CONSTRAINT "PersonJourney_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "JourneyStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonJourney" ADD CONSTRAINT "PersonJourney_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonJourney" ADD CONSTRAINT "PersonJourney_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EventInvitation" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"eventId" UUID NOT NULL,"organizationId" UUID,"inviterPersonId" UUID NOT NULL,"inviteeName" TEXT NOT NULL,"inviteePhone" TEXT,"normalizedPhone" TEXT,"tokenHash" TEXT NOT NULL,"channel" "InvitationChannel" NOT NULL DEFAULT 'WEB',"status" "InvitationStatus" NOT NULL DEFAULT 'CREATED',"registrationId" UUID,"registeredPersonId" UUID,"createdById" UUID,"sentAt" TIMESTAMP(3),"openedAt" TIMESTAMP(3),"respondedAt" TIMESTAMP(3),"optedOutAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "EventInvitation_tokenHash_key" ON "EventInvitation"("tokenHash");
CREATE UNIQUE INDEX "EventInvitation_registrationId_key" ON "EventInvitation"("registrationId");
CREATE INDEX "EventInvitation_eventId_status_idx" ON "EventInvitation"("eventId","status");
CREATE INDEX "EventInvitation_normalizedPhone_idx" ON "EventInvitation"("normalizedPhone");
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_inviterPersonId_fkey" FOREIGN KEY ("inviterPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_registeredPersonId_fkey" FOREIGN KEY ("registeredPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
