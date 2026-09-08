"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing-navbar";
// import { PaymentModal } from "@/components/pricing/payment-modal";
import {
  Activity,
  CheckCircle2,
  FileCheck,
  Zap,
  BarChart3,
  Sliders,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  Database,
  Layers,
  Search,
  Sparkles,
  HelpCircle,
  Mail,
  MapPin,
  Send,
  Building,
  User,
  AlertTriangle,
  Award,
  Globe,
  Users,
  Code,
  PieChart,
  Cloud,
  Lock,
  CreditCard,
  Building2,
  Smartphone,
} from "lucide-react";

export default function LandingPage() {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pricingCurrency, setPricingCurrency] = useState<"NGN" | "USD">("NGN");

  // Contact form state
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setFormData({ name: "", email: "", company: "", message: "" });
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Navigation Bar */}
      <LandingNavbar />

      {/* ========================================================================= */}
      {/* 1. HERO SECTION (#home)                                                   */}
      {/* ========================================================================= */}
      <section
        id="home"
        className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden border-b border-slate-800/60"
      >
        {/* Background Gradients & Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-600/20 to-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-10 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase shadow-inner">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Petrophysical Quality Assurance</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.15]">
              Automated Well Log <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Quality Assurance & Standardisation
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed max-w-3xl mx-auto">
              WellQC+ automatically validates LAS 2.0 files, detects anomalous spikes & flatlines, standardises raw mnemonics, and imputes missing curves with KNN ML models.
            </p>

            {/* CTA Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 transition-all duration-200"
              >
                <span>Check 2 Log Files for Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                href="#pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition-all duration-200"
              >
                <span>View Pricing Plans</span>
              </Link>
            </div>

            {/* Freemium Trust Note */}
            <p className="text-xs text-slate-400 flex items-center justify-center gap-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>No credit card required for your first 2 log file checks</span>
            </p>
          </div>

          {/* Hero Visual Mockup Preview */}
          <div className="mt-14 relative max-w-5xl mx-auto">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
              <div className="bg-slate-950 rounded-xl p-4 sm:p-6 space-y-6">
                {/* Mock Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="text-xs text-slate-400 font-mono ml-2">
                      LAS Audit Workspace &mdash; Well: ND-DELTA-07X
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                      94% EXCELLENT GRADE
                    </span>
                  </div>
                </div>

                {/* Mock Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 block">Overall Health</span>
                    <span className="text-2xl font-bold text-emerald-400">94 / 100</span>
                    <span className="text-[11px] text-emerald-500/80 block mt-1">Ready for Petrophysical Audit</span>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 block">Mnemonics Matched</span>
                    <span className="text-2xl font-bold text-cyan-400">8 / 8 Standard</span>
                    <span className="text-[11px] text-slate-400 block mt-1">100% Alias Confidence</span>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 block">Anomalies Detected</span>
                    <span className="text-2xl font-bold text-amber-400">2 Spikes</span>
                    <span className="text-[11px] text-amber-400/80 block mt-1">Depth: 7,420 - 7,425 FT</span>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 block">Missing Data Imputed</span>
                    <span className="text-2xl font-bold text-emerald-400">KNN ML</span>
                    <span className="text-[11px] text-slate-400 block mt-1">R² Score: 0.94</span>
                  </div>
                </div>

                {/* Mock Curve Row */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-slate-200">Gamma Ray (GR)</span>
                      <span className="text-slate-400 block text-[11px]">Mapped from GAPI &bull; Range: 15.2 - 138.4 GAPI</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">0.0% Nulls</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">VALID</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Metric Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-slate-800/80 text-center">
            <div>
              <span className="text-3xl font-extrabold text-white">10,000+</span>
              <span className="block text-sm text-slate-400 mt-1">LAS Files Processed</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-emerald-400">99.4%</span>
              <span className="block text-sm text-slate-400 mt-1">Mnemonic Accuracy</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-cyan-400">&lt; 3 Secs</span>
              <span className="block text-sm text-slate-400 mt-1">Audit Generation Time</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-white">100%</span>
              <span className="block text-sm text-slate-400 mt-1">Multi-Tenant Data Isolation</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. ABOUT US SECTION (#about)                                              */}
      {/* ========================================================================= */}
      <section id="about" className="py-24 bg-slate-900/40 relative border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
                <Building className="w-3.5 h-3.5" />
                <span>About WellQC+</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Designed for Petrophysicists, Geoscientists & Reservoir Teams
              </h2>

              <p className="text-slate-300 leading-relaxed text-base">
                In subsurface exploration, inaccurate well log data leads to costly errors in formation evaluation, reservoir modeling, and hydrocarbon volume estimations.
              </p>

              <p className="text-slate-400 leading-relaxed text-sm">
                WellQC+ was created to eliminate tedious manual cleaning of raw LAS files. Our AI-driven engine enforces physical boundary limits, cleans noisy sensor signals, standardises inconsistent mnemonics across different oilfield operators, and provides machine-learning powered missing value imputation.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <h4 className="font-semibold text-emerald-400 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Physical Boundary Audits
                  </h4>
                  <p className="text-xs text-slate-400">Strict bounds checking on GR, RHOB, NPHI, DT, RT, CALI, and SP curves.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <h4 className="font-semibold text-cyan-400 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Machine Learning Imputation
                  </h4>
                  <p className="text-xs text-slate-400">KNN & Spline algorithms to fill missing telemetry dropouts accurately.</p>
                </div>
              </div>
            </div>

            {/* Right Cards Stack */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl blur-xl opacity-20" />
              <div className="relative bg-slate-900 rounded-2xl border border-slate-800 p-8 space-y-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  Why Leading Energy Teams Trust WellQC+
                </h3>

                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="p-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <div>
                      <strong className="text-white block">Standardised Mnemonic Taxonomy</strong>
                      Automatically maps vendor-specific aliases (e.g. `DEN`, `RHOZ`, `BDEN`) to standard `RHOB`.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="p-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div>
                      <strong className="text-white block">Instant Anomaly Detection</strong>
                      Identifies borehole washouts, extreme Z-score spikes ($&gt;4\sigma$), and telemetry dropouts.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="p-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </span>
                    <div>
                      <strong className="text-white block">Official PDF Audit Certificates</strong>
                      Generate executive PDF compliance certificates and cleaned LAS exports for downstream software.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          {/* 8-Member Team Grid */}
          <div className="mt-20 pt-16 border-t border-slate-800/80">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Users className="w-3.5 h-3.5" />
                <span>The Engineering &amp; Analytics Team</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Our 8-Member Multidisciplinary Team
              </h3>
              <p className="text-slate-400 text-sm">
                Built by a specialized team of 2 Software Engineers, 4 Data Analysts, and 2 Cloud Engineers combining petrophysics, machine learning, and cloud infrastructure.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  id: "SE-1",
                  name: "Williams C. Ekwebelam",
                  title: "Software Engineer 1",
                  domain: "Core Engine & AI Lead",
                  description: "Architect of LAS Parser, Quality Scoring algorithms, AI Recommendation Engine, and Wireline Log Viewer.",
                  image: "/team/se1.webp", // Add photo URL e.g. "/team/se1.jpg"
                  initials: "WE",
                  badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                  icon: Code,
                },
                {
                  id: "SE-2",
                  name: "Obi Ngozi Elizabeth",
                  title: "Software Engineer 2",
                  domain: "Full-Stack UI & API Lead",
                  description: "Owner of Next.js App Shell, Auth System, Upload Workspace, REST APIs, and Mobile Responsiveness.",
                  image: "/team/se2.jpeg", // Drop se2.jpg into public/team/ to show photo
                  initials: "SE2",
                  badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                  icon: Code,
                },
                {
                  id: "DA-1",
                  name: "Nwashiole Felix Ugochukwu",
                  title: "Data Analyst 1",
                  domain: "Petrophysical Rules Lead",
                  description: "Defines physical min/max bounds, mnemonic alias dictionary, unit conversions, and domain validation.",
                  image: "/team/da1.jpeg", // Drop da1.jpg into public/team/ to show photo
                  initials: "DA1",
                  badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                  icon: PieChart,
                },
                {
                  id: "DA-2",
                  name: "Chukwura Somto",
                  title: "Data Analyst 2",
                  domain: "Imputation & ML Lead",
                  description: "Researches root causes of missing values and leads KNN & Spline imputation benchmarking metrics.",
                  image: "/team/da2.jpeg", // Drop da2.jpg into public/team/ to show photo
                  initials: "DA2",
                  badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                  icon: PieChart,
                },
                {
                  id: "DA-3",
                  name: "Mr. Timi",
                  title: "Data Analyst 3",
                  domain: "Basin Intelligence Lead",
                  description: "Drives dashboard KPIs, 7-day trend metrics, field performance ranking, and basin anomaly aggregation.",
                  image: "/team/da3.jpeg", // Drop da3.jpg into public/team/ to show photo
                  initials: "DA3",
                  badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                  icon: PieChart,
                },
                {
                  id: "DA-4",
                  name: "Nickson Sarah",
                  title: "Data Analyst 4",
                  domain: "Reporting & Quality Auditor",
                  description: "Manages PDF audit certificates, Excel workbooks, CSV export templates, and test file dataset validation.",
                  image: "/team/da4.jpeg", // Drop da4.jpg into public/team/ to show photo
                  initials: "DA4",
                  badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                  icon: PieChart,
                },
                {
                  id: "CE-1",
                  name: "Wanaemi Watson",
                  title: "Cloud Engineer 1",
                  domain: "Infrastructure & DevOps",
                  description: "Manages Vercel deployment, SSL/HTTPS configuration, CI/CD GitHub Actions, and performance tuning.",
                  image: "/team/ce1.jpeg", // Drop ce1.jpg into public/team/ to show photo
                  initials: "CE1",
                  badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
                  icon: Cloud,
                },
                {
                  id: "CE-2",
                  name: "Orji Okechukwu .D",
                  title: "Cloud Engineer 2",
                  domain: "Database, Security & FastAPI",
                  description: "Maintains Prisma ORM, Neon PostgreSQL multi-tenant isolation, and Python FastAPI microservice integration.",
                  image: "/team/ce2.jpeg", // Drop ce2.jpg into public/team/ to show photo
                  initials: "CE2",
                  badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
                  icon: Cloud,
                },
              ].map((member) => {
                const IconComponent = member.icon;
                return (
                  <div
                    key={member.id}
                    className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 hover:border-slate-700 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Role Badge & Icon */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2.5 py-1 rounded-md border text-[11px] font-mono font-bold ${member.badgeColor}`}>
                          {member.id}
                        </span>
                        <IconComponent className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                      </div>

                      {/* Avatar Image Placeholder Container */}
                      <div className="flex items-center gap-3.5 mb-4">
                        <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700/80 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-slate-200">
                              <User className="w-6 h-6 text-slate-500 mb-0.5" />
                              <span className="text-[9px] font-mono text-slate-500 font-bold">{member.initials}</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                            {member.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 block font-medium">
                            {member.title}
                          </span>
                        </div>
                      </div>

                      {/* Domain Title & Responsibilities */}
                      <p className="text-xs text-emerald-400 font-semibold mb-1">
                        {member.domain}
                      </p>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {member.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. PRODUCT SERVICES & FEATURES SECTION (#services)                       */}
      {/* ========================================================================= */}
      <section id="services" className="py-24 relative border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Core Services & Platform Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Complete End-to-End Well Log Quality Control
            </h2>
            <p className="text-slate-400 text-base">
              Everything you need to parse, clean, standardise, and audit subsurface log data in a single intuitive web application.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">LAS 2.0 Parser & Validation</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Parses Version, Well Info, Curve Metadata, and ASCII Data sections with robust handling of missing depth points and varied null indicators.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">AI Anomaly Quality Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Automatically flags impossible physical values, extreme Z-score spikes ($&gt;4\sigma$), sensor flatlines ($&gt;25$ points), and depth gaps.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Mnemonic Standardisation</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Matches non-standard operator mnemonics to standard petrophysical names using fuzzy logic and alias dictionaries with confidence scoring.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">KNN Data Imputation</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Benchmark 5 data imputation strategies (KNN, Cubic Spline, Linear Interpolation) with cross-validation RMSE &amp; R² preservation metrics.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Multi-Track Log Viewer</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Interactive SVG track display supporting Classic Paper Log and Dark Subsurface visual modes with depth tick marks and anomaly highlights.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">PDF &amp; Excel Exporters</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Export official executive PDF audit certificates and clean LAS 2.0 files ready for direct import into Techlog, Petrel, or IP.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. PRICING SECTION (#pricing)                                            */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-24 bg-slate-900/30 relative border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Paystack Supported Payment Gateway</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Start Free, Upgrade When You Grow
            </h2>
            <p className="text-slate-400 text-base">
              Try WellQC+ completely free for your first 2 log files. Upgrade seamlessly with Nigerian &amp; Global Cards, Bank Transfer, or USSD.
            </p>

            {/* Currency Switcher */}
            <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-inner mt-2">
              <span className="text-xs text-slate-400 font-mono px-2">Currency:</span>
              <button
                type="button"
                onClick={() => setPricingCurrency("NGN")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  pricingCurrency === "NGN"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ₦ NGN (Naira)
              </button>
              <button
                type="button"
                onClick={() => setPricingCurrency("USD")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  pricingCurrency === "USD"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                $ USD (Dollar)
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {/* Free Tier Card */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Free Starter</h3>
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold font-mono">
                    Freemium
                  </span>
                </div>
                <p className="text-slate-400 text-xs mb-6">Perfect for evaluating WellQC+ with your own LAS files.</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-white font-mono">$0 / ₦0</span>
                  <span className="text-slate-400 text-xs font-mono"> / 2 log file checks</span>
                </div>

                <ul className="space-y-3.5 text-sm text-slate-300 mb-8 border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>2 Free LAS Log Checks</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Full Quality Score Audit</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Mnemonic Standardisation</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Cleaned LAS 2.0 Export</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/register"
                className="w-full text-center py-3 px-4 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro Tier Card (Highlighted) */}
            <div className="bg-slate-900 rounded-2xl border-2 border-emerald-500 p-8 flex flex-col justify-between relative shadow-2xl shadow-emerald-500/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 text-xs font-extrabold tracking-wider uppercase shadow-md flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Most Popular</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Pro Petrophysicist</h3>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold font-mono">
                    Unlimited
                  </span>
                </div>
                <p className="text-slate-400 text-xs mb-6">Designed for active engineers and subsurface team leads.</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-white font-mono">
                    {pricingCurrency === "NGN" ? "₦75,000" : "$49"}
                  </span>
                  <span className="text-slate-400 text-xs font-mono"> / month</span>
                </div>

                <ul className="space-y-3.5 text-sm text-slate-300 mb-8 border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Unlimited LAS File Audits</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Multi-Track Interactive Log Viewer</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>KNN &amp; Spline Imputation Engine</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Multi-Well Side-by-Side Comparison</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Executive PDF Audit Certificates</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Priority Support</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <Link
                  href="/pricing"
                  className="w-full text-center py-3.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:from-emerald-300 hover:to-cyan-300 shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>View Plans &amp; Pay via Paystack</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <div className="text-center text-[10px] text-slate-400 font-mono">
                  Cards (Verve/Visa/MC), Bank Transfer, USSD
                </div>
              </div>
            </div>

            {/* Enterprise Tier Card */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Enterprise</h3>
                  <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold font-mono">
                    Custom
                  </span>
                </div>
                <p className="text-slate-400 text-xs mb-6">For E&amp;P corporations, service companies &amp; large teams.</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-white font-mono">Custom</span>
                  <span className="text-slate-400 text-xs font-mono"> / tailored deployment</span>
                </div>

                <ul className="space-y-3.5 text-sm text-slate-300 mb-8 border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Everything in Pro Plan</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Custom Corporate Mnemonics</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>On-Premise / Private Cloud Setup</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dedicated Technical Account Manager</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>REST API &amp; Webhook Integration</span>
                  </li>
                </ul>
              </div>

              <Link
                href="#contact"
                className="w-full text-center py-3 px-4 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </div>

          {/* Paystack Trust Badge Banner on Landing Page */}
          <div className="max-w-4xl mx-auto mt-12 p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white block">Secured by Paystack Payment Gateway</span>
                <span className="text-slate-400 text-[11px]">Instant automated subscription activation in Nigeria and globally.</span>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">Verve &amp; Mastercard</span>
              <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">Bank Transfer</span>
              <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">USSD</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. CONTACT US SECTION (#contact)                                          */}
      {/* ========================================================================= */}
      <section id="contact" className="py-24 relative border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Details */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Mail className="w-3.5 h-3.5" />
                <span>Get in Touch</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Have Questions? Talk to Our Technical Support Team
              </h2>
              <p className="text-slate-400 text-base leading-relaxed">
                Whether you need assistance with raw LAS file formats, custom enterprise deployments, or pricing details, we are here to help.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white text-sm block">Email Us</strong>
                    <span className="text-xs text-slate-400">support@wellqcplus.com &bull; sales@wellqcplus.com</span>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white text-sm block">Subsurface Engineering Hub</strong>
                    <span className="text-xs text-slate-400">Port Harcourt &amp; Lagos, Nigeria &bull; Global Remote Operations</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Contact Form */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-8 relative">
              {formSubmitted ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Thank You for Reaching Out!</h3>
                  <p className="text-sm text-slate-400">
                    Your message has been sent successfully. One of our petrophysical support engineers will respond within 2 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <h3 className="text-xl font-bold text-white mb-2">Send Us a Message</h3>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Dr. Samuel Williams"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="s.williams@energycorp.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Company / Organization
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Subsurface Energy Ltd"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Message
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your LAS file processing needs or questions..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-md transition-all"
                  >
                    <span>Send Message</span>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. FOOTER                                                                 */}
      {/* ========================================================================= */}
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
              <Link href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</Link>
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

      {/* Paystack Payment Modal */}
      {/* <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        defaultPlan="pro_monthly"
      /> */}
    </div>
  );
}
