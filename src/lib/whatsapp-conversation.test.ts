import { describe, expect, it } from "vitest";
import { advanceWhatsAppRegistration, type ConversationState } from "./whatsapp-conversation";

const base:ConversationState={step:"NAME",fullName:null,area:null,guestCount:0,transport:false,transportEnabled:true,eventName:"Night of a Thousand"};

describe("WhatsApp self-registration",()=>{
  it("starts a conversation when someone says hi",()=>expect(advanceWhatsAppRegistration(base,"hi")).toMatchObject({step:"NAME",reply:expect.stringContaining("full name")}));
  it("collects details without registering before YES",()=>{
    const name=advanceWhatsAppRegistration(base,"Jane Banda");
    expect(name).toMatchObject({step:"AREA",fullName:"Jane Banda"});
    const area=advanceWhatsAppRegistration({...base,step:"AREA",fullName:"Jane Banda"},"Kafue");
    expect(area).toMatchObject({step:"GUESTS",area:"Kafue"});
    const guests=advanceWhatsAppRegistration({...base,step:"GUESTS",fullName:"Jane Banda",area:"Kafue"},"2");
    expect(guests).toMatchObject({step:"TRANSPORT",guestCount:2});
    const transport=advanceWhatsAppRegistration({...base,step:"TRANSPORT",fullName:"Jane Banda",area:"Kafue",guestCount:2},"NO");
    expect(transport).toMatchObject({step:"CONFIRM",transport:false});
    expect(advanceWhatsAppRegistration({...base,step:"CONFIRM"},"YES")).toMatchObject({confirm:true});
  });
  it("rejects invalid counts and supports cancellation",()=>{
    expect(advanceWhatsAppRegistration({...base,step:"GUESTS"},"21").step).toBe("GUESTS");
    expect(advanceWhatsAppRegistration({...base,step:"CONFIRM"},"NO")).toMatchObject({cancel:true});
  });
});
