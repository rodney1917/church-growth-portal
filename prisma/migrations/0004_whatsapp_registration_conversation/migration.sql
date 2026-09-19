CREATE TABLE "WhatsAppRegistrationConversation" (
    "id" UUID NOT NULL,
    "session" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "eventId" UUID NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'NAME',
    "fullName" TEXT,
    "area" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "transport" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageId" TEXT,
    "registrationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppRegistrationConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppRegistrationConversation_session_chatId_key" ON "WhatsAppRegistrationConversation"("session", "chatId");
ALTER TABLE "WhatsAppRegistrationConversation" ADD CONSTRAINT "WhatsAppRegistrationConversation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
