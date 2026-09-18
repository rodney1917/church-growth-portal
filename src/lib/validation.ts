import { z } from "zod";

export const registrationSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().default(""),
  noPhone: z.coerce.boolean().default(false),
  contactPerson: z.string().trim().max(120).optional().default(""),
  relationship: z.enum(["SELF","MOTHER","FATHER","SPOUSE","BROTHER","SISTER","GUARDIAN","FRIEND","CHURCH_WORKER","OTHER"]).default("SELF"),
  area: z.string().trim().max(100).optional().default(""),
  guestCount: z.coerce.number().int().min(0).max(20).default(0),
  firstTimer: z.coerce.boolean().default(false),
  transportRequired: z.coerce.boolean().default(false),
  pickupLocation: z.string().trim().max(160).optional().default(""),
  source: z.enum(["WHATSAPP", "FACEBOOK", "INSTAGRAM", "TIKTOK", "CHURCH", "FRIEND", "RADIO", "SMS", "OTHER", "STAFF", "API", "SELF_WEB", "STAFF_CAPTURE", "IMPORT", "EVENT_DAY"]),
  sourceDetail: z.string().trim().max(160).optional().default(""),
  consentUpdates: z.coerce.boolean().default(false),
});

export const quickSoulSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().default(""),
  noPhone: z.coerce.boolean().default(false),
  area: z.string().trim().max(100).optional().default(""),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  ageGroup: z.enum(["CHILD", "TEEN", "YOUNG_ADULT", "ADULT", "SENIOR", "UNKNOWN"]).default("UNKNOWN"),
});

export const invitationSchema = z.object({
  eventId: z.string().uuid(),
  inviterPersonId: z.string().uuid(),
  inviteeName: z.string().trim().min(2).max(120),
  inviteePhone: z.string().trim().max(30).optional().default(""),
  channel: z.enum(["WEB","WHATSAPP","SMS","STAFF","EVENT_DAY","OTHER"]).default("WEB"),
});
