import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Event & Soul Winning Portal",description:"Registration, attendance, transport, souls and follow-up"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
