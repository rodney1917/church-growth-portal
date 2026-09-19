"use server";

import { compare, hash } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession, getSession, permissionsForUser, requireSession } from "@/lib/auth";
import { formatRegistrationNumber, hashToken, makeQrToken, normalizePhone } from "@/lib/security";
import { invitationSchema, quickSoulSchema, registrationSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { assertOrganizationAccess } from "@/lib/scope";

export type ActionState = { ok: boolean; message?: string; registrationNumber?: string; qrToken?: string; personId?: string; eventId?: string; invitationLinks?: string[] };

const bool = (form: FormData, key: string) => form.get(key) === "on" || form.get(key) === "true";

async function audit(userId: string | null, action: string, entityType: string, entityId?: string, after?: object) {
  const h = await headers();
  await db.auditLog.create({ data: { userId, action, entityType, entityId, after, ipAddress: h.get("x-forwarded-for")?.split(",")[0] } });
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await compare(password, user.passwordHash))) return { ok: false, message: "Email or password is incorrect." };
  const permissions = await permissionsForUser(user.id);
  await createSession({ userId: user.id, name: user.name, permissions });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(user.id, "AUTH_LOGIN", "User", user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function registerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const h = await headers();
  const key = h.get("x-forwarded-for")?.split(",")[0] || "local";
  if (!rateLimit(`register:${key}`)) return { ok: false, message: "Too many attempts. Please wait a minute and try again." };

  const parsed = registrationSchema.safeParse({
    eventId: form.get("eventId"), fullName: form.get("fullName"), phone: form.get("phone") || "", noPhone: bool(form,"noPhone"), contactPerson: form.get("contactPerson") || "", relationship: form.get("relationship")||"SELF", area: form.get("area") || "",
    guestCount: form.get("guestCount"), firstTimer: bool(form, "firstTimer"), transportRequired: bool(form, "transportRequired"),
    pickupLocation: form.get("pickupLocation") || "", source: form.get("source"), sourceDetail: form.get("sourceDetail") || "", consentUpdates: bool(form, "consentUpdates"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Please check your details." };
  const data = parsed.data;
  if (!data.noPhone && !data.phone) return { ok: false, message: "Enter a phone number or select No phone." };
  const normalizedPhone = data.phone ? normalizePhone(data.phone) : null;
  if (normalizedPhone && normalizedPhone.length < 11) return { ok: false, message: "Enter a valid mobile number." };
  const rawToken = makeQrToken();
  const session = await getSession();
  const invitationToken = String(form.get("invitationToken")||"");

  try {
    const registration = await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: data.eventId } });
      if (!event || !event.registrationOpen || event.deletedAt) throw new Error("Registration is closed for this event.");
      const invitation = invitationToken ? await tx.eventInvitation.findUnique({where:{tokenHash:hashToken(invitationToken)}}) : null;
      if(invitation && (invitation.eventId!==event.id || ["DECLINED","OPTED_OUT","REGISTERED"].includes(invitation.status))) throw new Error("This invitation is no longer available.");
      const exact = normalizedPhone ? await tx.person.findFirst({where:{normalizedPhone,fullName:{equals:data.fullName,mode:"insensitive"},deletedAt:null}}) : null;
      const person = exact ?? await tx.person.create({data:{fullName:data.fullName,phone:data.relationship==="SELF"?data.phone||null:null,normalizedPhone:data.relationship==="SELF"?normalizedPhone:null,area:data.area||null}});
      if(data.phone) await tx.personContact.create({data:{personId:person.id,value:data.phone,normalizedValue:normalizedPhone,type:"PHONE",contactPerson:data.contactPerson||null,relationship:data.relationship,isPrimary:true,consentUpdates:data.consentUpdates}});
      if(!exact && normalizedPhone){const candidates=await tx.personContact.findMany({where:{normalizedValue:normalizedPhone,personId:{not:person.id}},select:{personId:true},distinct:["personId"]});for(const candidate of candidates)await tx.possibleDuplicate.upsert({where:{personId_candidateId:{personId:person.id,candidateId:candidate.personId}},create:{personId:person.id,candidateId:candidate.personId,reason:"SHARED_PHONE",score:60},update:{}})}
      const existing = await tx.eventRegistration.findUnique({ where: { eventId_personId: { eventId: event.id, personId: person.id } } });
      let created;
      if (existing) created = await tx.eventRegistration.update({ where: { id: existing.id }, data: { qrTokenHash: hashToken(rawToken), consentUpdates: existing.consentUpdates || data.consentUpdates } });
      else {
        const sequenced = await tx.event.update({ where: { id: event.id }, data: { registrationSequence: { increment: 1 } }, select: { registrationSequence: true, registrationPrefix: true } });
        created = await tx.eventRegistration.create({ data: {
          eventId: event.id, personId: person.id, registrationNumber: formatRegistrationNumber(sequenced.registrationPrefix, sequenced.registrationSequence),
          qrTokenHash: hashToken(rawToken), source: session?"STAFF_CAPTURE":invitation?"OTHER":"SELF_WEB", sourceDetail: data.sourceDetail || null, guestCount: data.guestCount,
          partySize: data.guestCount + 1, firstTimer: data.firstTimer, transportRequired: data.transportRequired,
          consentUpdates: data.consentUpdates, registeredById:session?.userId||null,
        }});
      }
      if(invitation)await tx.eventInvitation.update({where:{id:invitation.id},data:{status:"REGISTERED",registrationId:created.id,registeredPersonId:person.id,respondedAt:new Date()}});
      return created;
    });
    await audit(null, "REGISTRATION_CREATED", "EventRegistration", registration.id, { source: data.source });
    return { ok: true, registrationNumber: registration.registrationNumber, qrToken: rawToken, personId: registration.personId, eventId: registration.eventId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Registration could not be completed." };
  }
}

export async function checkInAction(registrationId: string) {
  const session = await requireSession("attendance.check_in");
  const registration = await db.eventRegistration.findUnique({ where: { id: registrationId },include:{event:true} });
  if (!registration) return;
  await assertOrganizationAccess("attendance.check_in",registration.event.organizationId);
  await db.attendance.upsert({
    where: { registrationId },
    create: { eventId: registration.eventId, registrationId, checkedInById: session.userId, method: "MANUAL" },
    update: {},
  });
  await audit(session.userId, "ATTENDANCE_CHECK_IN", "EventRegistration", registrationId);
  revalidatePath("/check-in");
}

export async function reverseCheckInAction(form:FormData){const session=await requireSession("attendance.reverse");const registrationId=String(form.get("registrationId"));const reason=String(form.get("reason")||"").trim();if(reason.length<3)throw new Error("A reversal reason is required.");const attendance=await db.attendance.findUnique({where:{registrationId},include:{event:true}});if(!attendance)return;await assertOrganizationAccess("attendance.reverse",attendance.event.organizationId);await db.attendance.update({where:{id:attendance.id},data:{reversedAt:new Date(),reversalReason:reason}});await audit(session.userId,"ATTENDANCE_REVERSED","Attendance",attendance.id,{reason});revalidatePath("/check-in")}

export async function boardAction(registrationId: string, direction: "OUTBOUND" | "RETURN") {
  const session = await requireSession("transport.board");
  const registration=await db.eventRegistration.findUnique({where:{id:registrationId},include:{event:true}});if(!registration)return;await assertOrganizationAccess("transport.board",registration.event.organizationId);
  await db.transportBoarding.upsert({
    where: { registrationId_direction: { registrationId, direction } },
    create: { registrationId, direction, boardedById: session.userId, method: "MANUAL" }, update: {},
  });
  await audit(session.userId, `TRANSPORT_BOARD_${direction}`, "EventRegistration", registrationId);
  revalidatePath("/transport");
}

export async function allocateTransportAction(form:FormData){const session=await requireSession("transport.manage");const registrationId=String(form.get("registrationId"));const vehicleId=String(form.get("vehicleId"));const routeId=String(form.get("routeId"))||null;const pickupPointId=String(form.get("pickupPointId"))||null;const seatsRequired=Math.max(1,Number(form.get("seatsRequired")||1));const override=bool(form,"capacityOverride");const[registration,vehicle,allocated]=await Promise.all([db.eventRegistration.findUnique({where:{id:registrationId},include:{event:true}}),db.transportVehicle.findUnique({where:{id:vehicleId}}),db.transportAssignment.aggregate({where:{vehicleId},_sum:{seatsRequired:true}})]);if(!registration||!vehicle||vehicle.eventId!==registration.eventId)throw new Error("Invalid transport assignment.");await assertOrganizationAccess("transport.manage",registration.event.organizationId);if((allocated._sum.seatsRequired||0)+seatsRequired>vehicle.capacity&&!override)throw new Error("Vehicle capacity would be exceeded.");await db.transportAssignment.upsert({where:{registrationId},create:{registrationId,vehicleId,routeId,pickupPointId,seatsRequired,capacityOverride:override},update:{vehicleId,routeId,pickupPointId,seatsRequired,capacityOverride:override}});await audit(session.userId,"TRANSPORT_ALLOCATED","EventRegistration",registrationId,{vehicleId,seatsRequired,override});revalidatePath("/transport")}

export async function soulDecisionAction(registrationId: string) {
  const session = await requireSession("souls.capture");
  const registration = await db.eventRegistration.findUnique({ where: { id: registrationId },include:{event:true} });
  if (!registration) return;
  await assertOrganizationAccess("souls.capture",registration.event.organizationId);
  const decision = await db.salvationDecision.upsert({
    where: { eventId_personId: { eventId: registration.eventId, personId: registration.personId } },
    create: { eventId: registration.eventId, personId: registration.personId, registrationId, workerId: session.userId }, update: {},
  });
  const salvationStage=await db.journeyStage.findFirst({where:{key:"SALVATION",enabled:true},orderBy:{organizationId:"asc"}});
  if(salvationStage)await db.personJourney.create({data:{personId:registration.personId,eventId:registration.eventId,stageId:salvationStage.id,status:"COMPLETED",workerId:session.userId,effectiveDate:new Date()}});
  await db.followUpAssignment.upsert({
    where: { salvationDecisionId: decision.id },
    create: { eventId: registration.eventId, personId: registration.personId, registrationId, salvationDecisionId: decision.id }, update: {},
  });
  await audit(session.userId, "SALVATION_DECISION", "Person", registration.personId);
  revalidatePath("/souls");
}

export async function quickSoulAction(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession("souls.capture");
  const parsed = quickSoulSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  const data = parsed.data;
  if(!data.noPhone&&!data.phone)return{ok:false,message:"Enter a phone number or select No phone."};
  const normalizedPhone = data.phone?normalizePhone(data.phone):null;
  const decision = await db.$transaction(async (tx) => {
    const exact=normalizedPhone?await tx.person.findFirst({where:{normalizedPhone,fullName:{equals:data.fullName,mode:"insensitive"}}}):null;
    const person=exact??await tx.person.create({data:{fullName:data.fullName,phone:data.phone||null,normalizedPhone,area:data.area||null,gender:data.gender,ageGroup:data.ageGroup}});
    if(data.phone&&!exact)await tx.personContact.create({data:{personId:person.id,value:data.phone,normalizedValue:normalizedPhone,relationship:"SELF",isPrimary:true}});
    const saved = await tx.salvationDecision.upsert({
      where: { eventId_personId: { eventId: data.eventId, personId: person.id } },
      create: { eventId: data.eventId, personId: person.id, workerId: session.userId }, update: {},
    });
    await tx.followUpAssignment.upsert({
      where: { salvationDecisionId: saved.id },
      create: { eventId: data.eventId, personId: person.id, salvationDecisionId: saved.id }, update: {},
    });
    const stage=await tx.journeyStage.findFirst({where:{key:"SALVATION",enabled:true}});if(stage)await tx.personJourney.create({data:{personId:person.id,eventId:data.eventId,stageId:stage.id,status:"COMPLETED",workerId:session.userId}});
    return saved;
  });
  await audit(session.userId, "QUICK_SOUL_CAPTURE", "SalvationDecision", decision.id);
  return { ok: true, message: "Soul saved. Ready for the next person." };
}

export async function assignFollowUpAction(assignmentId: string, workerId: string) {
  const session = await requireSession("followup.assign");
  await db.followUpAssignment.update({ where: { id: assignmentId }, data: { assignedWorkerId: workerId, status: "ASSIGNED" } });
  await audit(session.userId, "FOLLOW_UP_ASSIGNED", "FollowUpAssignment", assignmentId, { workerId });
  revalidatePath("/follow-up");
}

export async function assignFollowUpForm(form: FormData) {
  await assignFollowUpAction(String(form.get("assignmentId")), String(form.get("workerId")));
}

export async function updateFollowUpAction(form: FormData) {
  const session = await requireSession("followup.notes");
  const id = String(form.get("assignmentId"));
  const status = String(form.get("status")) as "NEW"|"ASSIGNED"|"CONTACTED"|"NO_ANSWER"|"FOLLOW_UP_REQUIRED"|"FOUNDATION_SCHOOL"|"CELL_ASSIGNED"|"CHURCH_ATTENDING"|"ESTABLISHED";
  const notes = String(form.get("notes") || "").trim();
  await db.$transaction(async tx => {
    await tx.followUpAssignment.update({where:{id},data:{status,lastContactAt:new Date()}});
    if(notes)await tx.followUpInteraction.create({data:{assignmentId:id,workerId:session.userId,channel:"PHONE",notes}});
  });
  await audit(session.userId,"FOLLOW_UP_UPDATED","FollowUpAssignment",id,{status});
  revalidatePath("/follow-up");
}

export async function createUserAction(form: FormData) {
  const session=await requireSession("users.manage");const email=String(form.get("email")).trim().toLowerCase();const roleId=String(form.get("roleId"));
  const user=await db.user.create({data:{name:String(form.get("name")).trim(),email,passwordHash:await hash(String(form.get("password")),12),roles:{create:{roleId}}}});
  await audit(session.userId,"USER_CREATED","User",user.id,{email});revalidatePath("/users");
}

export async function createEventAction(form: FormData) {
  const session=await requireSession("events.manage");const event=await db.event.create({data:{name:String(form.get("name")).trim(),code:String(form.get("code")).trim().toUpperCase(),registrationPrefix:String(form.get("prefix")).trim().toUpperCase(),date:new Date(`${String(form.get("date"))}T00:00:00.000Z`),startTime:String(form.get("startTime")||"")||null,registrationOpen:bool(form,"registrationOpen"),transportEnabled:bool(form,"transportEnabled"),soulCaptureEnabled:bool(form,"soulCaptureEnabled"),status:"DRAFT"}});
  await audit(session.userId,"EVENT_CREATED","Event",event.id);revalidatePath("/events");
}

export async function createInvitationsAction(_:ActionState,form:FormData):Promise<ActionState>{
  const eventId=String(form.get("eventId"));const inviterPersonId=String(form.get("inviterPersonId"));const capability=String(form.get("registrationQrToken"));
  const registration=await db.eventRegistration.findFirst({where:{eventId,personId:inviterPersonId,qrTokenHash:hashToken(capability),deletedAt:null},include:{event:true}});
  if(!registration)return{ok:false,message:"Your registration could not be verified."};
  const links:string[]=[];
  for(let index=1;index<=5;index++){
    const parsed=invitationSchema.safeParse({eventId,inviterPersonId,inviteeName:form.get(`inviteeName${index}`),inviteePhone:form.get(`inviteePhone${index}`),channel:form.get(`channel${index}`)||"WEB"});
    if(!parsed.success)continue;const token=makeQrToken();const d=parsed.data;
    const invitation=await db.eventInvitation.create({data:{eventId,organizationId:registration.event.organizationId,inviterPersonId,inviteeName:d.inviteeName,inviteePhone:d.inviteePhone||null,normalizedPhone:d.inviteePhone?normalizePhone(d.inviteePhone):null,tokenHash:hashToken(token),channel:d.channel}});
    links.push(`${process.env.APP_URL||"http://localhost:3000"}/invite/${token}`);await audit(null,"INVITATION_CREATED","EventInvitation",invitation.id,{eventId,channel:d.channel});
  }
  return links.length?{ok:true,message:`${links.length} invitation${links.length===1?"":"s"} created.`,invitationLinks:links}:{ok:false,message:"Add at least one invitee name."};
}

export async function declineInvitationAction(token:string,optOut:boolean){
  const invitation=await db.eventInvitation.findUnique({where:{tokenHash:hashToken(token)}});if(!invitation)return;
  await db.eventInvitation.update({where:{id:invitation.id},data:{status:optOut?"OPTED_OUT":"DECLINED",respondedAt:new Date(),optedOutAt:optOut?new Date():null}});
  await audit(null,optOut?"INVITATION_OPTED_OUT":"INVITATION_DECLINED","EventInvitation",invitation.id);
  redirect(`/invite/${token}?response=${optOut?"opted-out":"declined"}`);
}

export async function recordJourneyAction(form:FormData){
  const session=await requireSession("journey.manage");const personId=String(form.get("personId"));const stageId=String(form.get("stageId"));const organizationId=String(form.get("organizationId")||"")||null;
  const status=String(form.get("status")) as "NOT_STARTED"|"IN_PROGRESS"|"SCHEDULED"|"COMPLETED"|"PAUSED";
  const entry=await db.personJourney.create({data:{personId,stageId,organizationId,status,workerId:session.userId,effectiveDate:new Date(String(form.get("effectiveDate")||new Date().toISOString())),location:String(form.get("location")||"")||null,notes:String(form.get("notes")||"")||null}});
  await audit(session.userId,"JOURNEY_PROGRESS_RECORDED","PersonJourney",entry.id,{personId,stageId,status});revalidatePath(`/people/${personId}`);
}
