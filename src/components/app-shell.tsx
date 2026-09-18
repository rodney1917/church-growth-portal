import Link from "next/link";
import { ClipboardCheck, HeartHandshake, LayoutDashboard, LogOut, QrCode, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { requireSession } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <div className="shell"><header className="topbar"><div className="brand"><span className="brand-mark">E+</span><span>Event & Soul Winning</span></div><form action={logoutAction} style={{marginLeft:"auto"}}><button className="btn btn-outline" title="Sign out" style={{minHeight:38,padding:"0 10px"}}><LogOut size={18}/></button></form></header><nav className="bottom-nav"><Link href="/dashboard"><LayoutDashboard size={20}/>Dashboard</Link><Link href="/registrations"><UsersRound size={20}/>People</Link><Link href="/check-in"><QrCode size={20}/>Check in</Link><Link href="/souls"><HeartHandshake size={20}/>Souls</Link><Link href="/follow-up"><ClipboardCheck size={20}/>Follow-up</Link></nav><main className="page"><div className="muted" style={{fontSize:12,marginBottom:8}}>Signed in as {session.name}</div>{children}</main></div>;
}
