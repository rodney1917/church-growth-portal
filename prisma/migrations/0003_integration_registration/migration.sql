CREATE TABLE "IntegrationRegistration" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "registrationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationRegistration_provider_externalId_key" ON "IntegrationRegistration"("provider", "externalId");
CREATE INDEX "IntegrationRegistration_registrationId_idx" ON "IntegrationRegistration"("registrationId");
ALTER TABLE "IntegrationRegistration" ADD CONSTRAINT "IntegrationRegistration_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
