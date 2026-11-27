import Link from "next/link";
import { WellQCLogo } from "@/components/ui/wellqc-logo";
import { ScrollReveal } from "./scroll-reveal";

export function LandingFooter() {
  return (
    <footer className="py-12 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs border-t border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" delay={0.1} distance={20} className="space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
            <WellQCLogo iconSize={28} showTagline={true} />

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <Link href="#home" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Home</Link>
              <Link href="#about" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">About Us</Link>
              <Link href="#capabilities" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Capabilities</Link>
              <Link href="#book-demo" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Book a Demo</Link>
              <Link href="#contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Contact</Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
            <p>&copy; {new Date().getFullYear()} WellQCPlus Subsurface Analytics Inc. All rights reserved.</p>
            <p className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span>&bull;</span>
              <span>Terms of Service</span>
              <span>&bull;</span>
              <span>Data Protection Agreement</span>
            </p>
          </div>
        </ScrollReveal>
      </div>
    </footer>
  );
}
