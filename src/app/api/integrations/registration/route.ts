import{NextRequest,NextResponse}from"next/server";import{safeEqual,normalizePhone,makeQrToken,hashToken,formatRegistrationNumber}from"@/lib/security";import{findRegistrations}from"@/lib/lookup";import{db}from"@/lib/db";import{integrationRegistrationSchema}from"@/lib/integration-registration";
function authorized(req:NextRequest){const expected=process.env.INTEGRATION_API_KEY||"";const supplied=req.headers.get("x-api-key")||"";return expected.length>=24&&safeEqual(expected,supplied)}
export async function GET(req:NextRequest){if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});const q=req.nextUrl.searchParams.get("q")||"";const rows=await findRegistrations(q);return NextResponse.json(rows.map(r=>({registrationNumber:r.registrationNumber,name:r.person.fullName,area:r.person.area,checkedIn:Boolean(r.attendance),transportRequired:r.transportRequired})))}

export async function POST(req:NextRequest){
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
  const parsed=integrationRegistrationSchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"A confirmed registration needs an event code, name, source and unique message ID."},{status:400});
  const data=parsed.data;
  const phone=data.phone?normalizePhone(data.phone):null;
  if(phone&&phone.length<11)return NextResponse.json({error:"Invalid phone number"},{status:400});
  try{
    const result=await db.$transaction(async tx=>{
      const prior=await tx.integrationRegistration.findUnique({where:{provider_externalId:{provider:data.provider,externalId:data.externalId}},include:{registration:true}});
      if(prior)return {registrationNumber:prior.registration.registrationNumber,personId:prior.registration.personId,created:false};
      const event=await tx.event.findUnique({where:{code:data.eventCode}});
      if(!event||!event.registrationOpen||event.deletedAt)throw new Error("EVENT_CLOSED");
      const person=phone?await tx.person.findFirst({where:{normalizedPhone:phone,fullName:{equals:data.fullName,mode:"insensitive"},deletedAt:null}}):null;
      const savedPerson=person??await tx.person.create({data:{fullName:data.fullName,phone:data.phone||null,normalizedPhone:phone,area:data.area||null}});
      if(phone&&!person)await tx.personContact.create({data:{personId:savedPerson.id,value:data.phone,normalizedValue:phone,type:"PHONE",relationship:"SELF",isPrimary:true,consentUpdates:data.consentUpdates}});
      let registration=await tx.eventRegistration.findUnique({where:{eventId_personId:{eventId:event.id,personId:savedPerson.id}}});
      if(!registration){
        const sequence=await tx.event.update({where:{id:event.id},data:{registrationSequence:{increment:1}},select:{registrationSequence:true,registrationPrefix:true}});
        registration=await tx.eventRegistration.create({data:{eventId:event.id,personId:savedPerson.id,registrationNumber:formatRegistrationNumber(sequence.registrationPrefix,sequence.registrationSequence),qrTokenHash:hashToken(makeQrToken()),source:data.source,sourceDetail:data.provider,consentUpdates:data.consentUpdates}});
      }
      await tx.integrationRegistration.create({data:{provider:data.provider,externalId:data.externalId,registrationId:registration.id}});
      await tx.auditLog.create({data:{action:"INTEGRATION_REGISTRATION_CREATED",entityType:"EventRegistration",entityId:registration.id,after:{provider:data.provider,externalId:data.externalId}}});
      return {registrationNumber:registration.registrationNumber,personId:savedPerson.id,created:true};
    });
    return NextResponse.json(result,{status:result.created?201:200});
  }catch(error){
    const retry=await db.integrationRegistration.findUnique({where:{provider_externalId:{provider:data.provider,externalId:data.externalId}},include:{registration:true}});
    if(retry)return NextResponse.json({registrationNumber:retry.registration.registrationNumber,personId:retry.registration.personId,created:false});
    if(error instanceof Error&&error.message==="EVENT_CLOSED")return NextResponse.json({error:"Event is not open for registration"},{status:409});
    return NextResponse.json({error:"Registration could not be completed"},{status:500});
  }
}
