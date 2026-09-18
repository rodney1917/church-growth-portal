export type MatchCandidate={id:string;fullName:string;normalizedPhone:string|null;area?:string|null};
export function exactPersonMatch(candidates:MatchCandidate[],name:string,phone:string|null){if(!phone)return null;return candidates.find(c=>c.normalizedPhone===phone&&c.fullName.trim().toLowerCase()===name.trim().toLowerCase())??null}
export function possibleSharedPhoneMatches(candidates:MatchCandidate[],phone:string|null,excludeId?:string){if(!phone)return[];return candidates.filter(c=>c.id!==excludeId&&c.normalizedPhone===phone)}
export function registrationTotal(registrations:number,invitations:number){void invitations;return registrations}
export function canAllocate(capacity:number,allocated:number,seats:number,override=false){return override||allocated+seats<=capacity}
export function canTransitionInvitation(from:string,to:string){const allowed:Record<string,string[]>={CREATED:["QUEUED","SENT","OPENED","DECLINED","OPTED_OUT","FAILED"],QUEUED:["SENT","DELIVERED","FAILED","OPTED_OUT"],SENT:["DELIVERED","OPENED","REGISTERED","DECLINED","OPTED_OUT","FAILED"],DELIVERED:["OPENED","REGISTERED","DECLINED","OPTED_OUT"],OPENED:["REGISTERED","DECLINED","OPTED_OUT"],FAILED:["QUEUED","OPTED_OUT"],REGISTERED:[],DECLINED:[],OPTED_OUT:[]};return allowed[from]?.includes(to)??false}
export function scopeAllows(unrestricted:boolean,allowedIds:string[],organizationId:string|null){return unrestricted||Boolean(organizationId&&allowedIds.includes(organizationId))}
export function duplicateCheckIn(existing:{reversedAt:Date|null}|null){return Boolean(existing&&!existing.reversedAt)}
export function safePersonContact(phone:string,relationship:string){return{personPhone:relationship==="SELF"?phone:null,contactValue:phone}}
