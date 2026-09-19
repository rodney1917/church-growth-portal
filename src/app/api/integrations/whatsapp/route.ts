import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { advanceWhatsAppRegistration, type ConversationStep } from "@/lib/whatsapp-conversation";
import { formatRegistrationNumber, hashToken, makeQrToken, normalizePhone, safeEqual } from "@/lib/security";

const messageSchema=z.object({session:z.string().min(1).max(100),chatId:z.string().min(1).max(160),messageId:z.string().min(1).max(200),text:z.string().max(500),eventCode:z.string().max(60).optional()});

export async function POST(req:NextRequest){
  const expected=process.env.INTEGRATION_API_KEY||"";
  if(expected.length<24||!safeEqual(expected,req.headers.get("x-api-key")||""))return NextResponse.json({error:"Unauthorized"},{status:401});
  const parsed=messageSchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Invalid message"},{status:400});
  const {session,chatId,messageId,text,eventCode}=parsed.data;
  if(!/^\d+@(c\.us|lid)$/.test(chatId))return NextResponse.json({reply:null,ignored:true});
  try{
    return NextResponse.json(await db.$transaction(async tx=>{
      let conversation=await tx.whatsAppRegistrationConversation.findUnique({where:{session_chatId:{session,chatId}}});
      if(conversation?.lastMessageId===messageId)return{reply:null,duplicate:true};
      if(conversation?.step==="DONE"&&eventCode){await tx.whatsAppRegistrationConversation.delete({where:{id:conversation.id}});conversation=null;}
      else if(conversation?.step==="DONE"&&["HI","HELLO","REGISTER","START"].includes(text.trim().toUpperCase())){
        if(conversation.registrationId){const registration=await tx.eventRegistration.findUnique({where:{id:conversation.registrationId}});return{reply:`You are registered. Your number is ${registration?.registrationNumber||"available from event staff"}. Keep it for check-in.`};}
        await tx.whatsAppRegistrationConversation.delete({where:{id:conversation.id}});conversation=null;
      }
      if(!conversation){
        const available=await tx.event.findMany({where:{registrationOpen:true,deletedAt:null},orderBy:{date:"asc"},take:10});
        if(!available.length)return{reply:"Registration is currently closed."};
        const event=eventCode?available.find(e=>e.code===eventCode):available.length===1?available[0]:null;
        if(!event)return{reply:`Please reply REGISTER followed by an event code: ${available.map(e=>`${e.code} (${e.name})`).join(", ")}.`};
        conversation=await tx.whatsAppRegistrationConversation.create({data:{session,chatId,eventId:event.id}});
      }
      const event=await tx.event.findUnique({where:{id:conversation.eventId}});
      if(!event||!event.registrationOpen||event.deletedAt)return{reply:"Registration is currently closed."};
      const outcome=advanceWhatsAppRegistration({step:conversation.step as ConversationStep,fullName:conversation.fullName,area:conversation.area,guestCount:conversation.guestCount,transport:conversation.transport,transportEnabled:event.transportEnabled,eventName:event.name},text);
      if(outcome.confirm){
        const phone=chatId.endsWith("@c.us")?normalizePhone(chatId.split("@")[0]):null;
        const person=phone?await tx.person.findFirst({where:{normalizedPhone:phone,fullName:{equals:conversation.fullName!,mode:"insensitive"},deletedAt:null}}):null;
        const savedPerson=person??await tx.person.create({data:{fullName:conversation.fullName!,phone,normalizedPhone:phone,area:conversation.area}});
        if(phone&&!person)await tx.personContact.create({data:{personId:savedPerson.id,value:phone,normalizedValue:phone,type:"WHATSAPP",relationship:"SELF",isPrimary:true,consentUpdates:false}});
        let registration=await tx.eventRegistration.findUnique({where:{eventId_personId:{eventId:event.id,personId:savedPerson.id}}});
        if(!registration){
          const sequence=await tx.event.update({where:{id:event.id},data:{registrationSequence:{increment:1}},select:{registrationSequence:true,registrationPrefix:true}});
          registration=await tx.eventRegistration.create({data:{eventId:event.id,personId:savedPerson.id,registrationNumber:formatRegistrationNumber(sequence.registrationPrefix,sequence.registrationSequence),qrTokenHash:hashToken(makeQrToken()),source:"WHATSAPP",sourceDetail:"WAHA_SELF_REGISTRATION",guestCount:conversation.guestCount,partySize:conversation.guestCount+1,transportRequired:conversation.transport,consentUpdates:false}});
          await tx.auditLog.create({data:{action:"WHATSAPP_SELF_REGISTRATION_CREATED",entityType:"EventRegistration",entityId:registration.id,after:{eventCode:event.code}}});
        }
        await tx.whatsAppRegistrationConversation.update({where:{id:conversation.id},data:{step:"DONE",registrationId:registration.id,lastMessageId:messageId}});
        return{reply:`Registration confirmed for ${event.name}. Your number is ${registration.registrationNumber}. Keep this message and give the number at the entrance.`};
      }
      await tx.whatsAppRegistrationConversation.update({where:{id:conversation.id},data:{step:outcome.step,fullName:outcome.fullName??conversation.fullName,area:outcome.area??conversation.area,guestCount:outcome.guestCount??conversation.guestCount,transport:outcome.transport??conversation.transport,lastMessageId:messageId}});
      return{reply:outcome.reply};
    }));
  }catch{return NextResponse.json({error:"Message could not be processed"},{status:500});}
}
