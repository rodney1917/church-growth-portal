import { z } from "zod";

export const integrationRegistrationSchema = z.object({
  provider: z.enum(["N8N", "WAHA", "SMS"]),
  externalId: z.string().trim().min(1).max(160),
  eventCode: z.string().trim().min(1).max(60),
  confirmed: z.literal(true),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().default(""),
  area: z.string().trim().max(100).optional().default(""),
  source: z.enum(["WHATSAPP", "SMS", "OTHER"]),
  consentUpdates: z.boolean().default(false),
});
