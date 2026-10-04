import Link from "next/link";
import { Activity } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="py-12 bg-slate-950 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <span className="font-bold text-lg text-white">WellQC+</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link href="#home" className="hover:text-emerald-400 transition-colors">Home</Link>
            <Link href="#about" className="hover:text-emerald-400 transition-colors">About Us</Link>
            <Link href="#services" className="hover:text-emerald-400 transition-colors">Services</Link>
            <Link href="#contact" className="hover:text-emerald-400 transition-colors">Contact</Link>
            <Link href="/login" className="hover:text-emerald-400 transition-colors">Sign In</Link>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
          <p>&copy; {new Date().getFullYear()} WellQC+ Subsurface Analytics Inc. All rights reserved.</p>
          <p className="flex items-center gap-4">
            <span>Privacy Policy</span>
            <span>&bull;</span>
            <span>Terms of Service</span>
            <span>&bull;</span>
            <span>Data Protection Agreement</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
