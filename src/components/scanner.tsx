"use client";
import { useEffect, useId, useState } from "react";
import { Camera, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function Scanner({destination}:{destination:string}){const id=`reader-${useId().replace(/:/g,"")}`;const[open,setOpen]=useState(false);const[error,setError]=useState("");const router=useRouter();
 useEffect(()=>{if(!open)return;let scanner:{stop:()=>Promise<void>}|undefined;import("html5-qrcode").then(async({Html5Qrcode})=>{const instance=new Html5Qrcode(id);scanner=instance;try{await instance.start({facingMode:"environment"},{fps:10,qrbox:{width:240,height:240}},(value)=>{instance.stop().finally(()=>router.push(`${destination}?q=${encodeURIComponent(`token:${value}`)}`))},()=>{})}catch{setError("Camera could not start. Use search below.")}});return()=>{scanner?.stop().catch(()=>{})}},[open,id,destination,router]);
 if(!open)return <button className="btn btn-accent" onClick={()=>setOpen(true)}><Camera size={22}/>Scan QR</button>;
 return <div className="panel"><div className="actions" style={{justifyContent:"space-between"}}><strong>Point camera at QR</strong><button className="btn btn-outline" onClick={()=>setOpen(false)} title="Close scanner"><X size={20}/></button></div><div id={id} style={{marginTop:12}}/>{error&&<div className="notice error">{error}</div>}</div>}
