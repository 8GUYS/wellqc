import {
  AlertTriangle,
  Award,
  Building,
  CheckCircle2,
  Cloud,
  Code,
  FileSpreadsheet,
  PieChart,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

const TEAM_MEMBERS = [
  {
    id: "SE-1",
    name: "Williams C. Ekwebelam",
    title: "Software Engineer 1",
    domain: "Core Engine & AI Lead",
    description: "Architect of LAS Parser, Quality Scoring algorithms, AI Recommendation Engine, and Wireline Log Viewer.",
    image: "/team/se1.webp",
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
    image: "/team/se2.jpeg",
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
    image: "/team/da1.jpeg",
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
    image: "/team/da2.jpeg",
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
    image: "/team/da3.jpeg",
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
    image: "/team/da4.jpeg",
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
    image: "/team/ce1.jpeg",
    initials: "CE1",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    icon: Cloud,
  },
  {
    id: "CE-2",
    name: "Orji Okechukwu .D",
    title: "Cloud Engineer 2",
    domain: "Database, Security & FastAPI",
    description: "Maintains SQLAlchemy ORM, PostgreSQL multi-tenant isolation, and Python FastAPI microservice integration.",
    image: "/team/ce2.jpeg",
    initials: "CE2",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    icon: Cloud,
  },
];

export function AboutSection() {
  return (
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
                    Identifies borehole washouts, extreme Z-score spikes (&gt;4&sigma;), and telemetry dropouts.
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
            {TEAM_MEMBERS.map((member) => {
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

                    {/* Avatar Image Container */}
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
  );
}
