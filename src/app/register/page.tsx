import { format } from "date-fns";
import { db } from "@/lib/db";
import { RegistrationForm } from "@/components/registration-form";
export const dynamic = "force-dynamic";

export default async function RegisterPage(){const event=await db.event.findFirst({where:{registrationOpen:true,deletedAt:null},orderBy:{date:"asc"}});if(!event)return <main className="public-shell"><div className="public-wrap"><div className="public-head"><div className="brand"><span className="brand-mark">E+</span> Event & Soul Winning</div><h1>Registration is currently closed</h1></div></div></main>;return <main className="public-shell"><div className="public-wrap"><header className="public-head"><div className="brand"><span className="brand-mark">E+</span> Event & Soul Winning</div><h1>{event.name}</h1><p>{format(event.date,"EEEE, d MMMM yyyy")}{event.startTime?` at ${event.startTime}`:""}</p>{event.venue&&<p>{event.venue}</p>}</header><section className="panel"><p className="eyebrow">Register to attend</p><RegistrationForm event={{id:event.id,name:event.name,dateLabel:format(event.date,"EEEE, d MMMM yyyy"),transportEnabled:event.transportEnabled}}/></section></div></main>}
