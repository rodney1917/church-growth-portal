export type ConversationStep = "NAME" | "AREA" | "GUESTS" | "TRANSPORT" | "CONFIRM" | "DONE";
export type ConversationState = {step:ConversationStep;fullName:string|null;area:string|null;guestCount:number;transport:boolean;transportEnabled:boolean;eventName:string};
export type ConversationResult = {step:ConversationStep;reply:string;fullName?:string;area?:string;guestCount?:number;transport?:boolean;confirm?:boolean;cancel?:boolean};

export function advanceWhatsAppRegistration(state:ConversationState,raw:string):ConversationResult{
  const text=raw.trim();const upper=text.toUpperCase();
  if(upper==="CANCEL"||upper==="STOP")return{step:"DONE",reply:"Registration cancelled. Send HI to start again.",cancel:true};
  if(state.step==="NAME"){
    if(!text||["HI","HELLO","REGISTER","START"].includes(upper))return{step:"NAME",reply:`Welcome to ${state.eventName} registration. What is your full name?`};
    if(text.length<2||text.length>120)return{step:"NAME",reply:"Please send your full name (2-120 characters)."};
    return{step:"AREA",fullName:text,reply:"Which area do you live in?"};
  }
  if(state.step==="AREA"){
    if(text.length<2||text.length>100)return{step:"AREA",reply:"Please send your area (2-100 characters)."};
    return{step:"GUESTS",area:text,reply:"How many guests are coming with you? Reply with a number from 0 to 20."};
  }
  if(state.step==="GUESTS"){
    if(!/^(?:[0-9]|1[0-9]|20)$/.test(text))return{step:"GUESTS",reply:"Reply with a number from 0 to 20."};
    const guestCount=Number(text);
    if(state.transportEnabled)return{step:"TRANSPORT",guestCount,reply:"Do you need transport? Reply YES or NO."};
    return{step:"CONFIRM",guestCount,reply:`Please confirm: ${state.fullName}, ${state.area}, ${guestCount} guest(s). Reply YES to register or NO to cancel.`};
  }
  if(state.step==="TRANSPORT"){
    if(!["YES","NO"].includes(upper))return{step:"TRANSPORT",reply:"Do you need transport? Reply YES or NO."};
    const transport=upper==="YES";
    return{step:"CONFIRM",transport,reply:`Please confirm: ${state.fullName}, ${state.area}, ${state.guestCount} guest(s), transport ${transport?"yes":"no"}. Reply YES to register or NO to cancel.`};
  }
  if(state.step==="CONFIRM"){
    if(upper==="YES")return{step:"DONE",reply:"",confirm:true};
    if(upper==="NO")return{step:"DONE",reply:"Registration cancelled. Send HI to start again.",cancel:true};
    return{step:"CONFIRM",reply:"Reply YES to register or NO to cancel."};
  }
  return{step:"DONE",reply:"You are already registered. Send HI to see your registration number."};
}
