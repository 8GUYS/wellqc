import {
  Activity,
  BarChart3,
  Database,
  FileCheck,
  FileSpreadsheet,
  Sliders,
  Zap,
} from "lucide-react";

export function ServicesSection() {
  return (
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
              Automatically flags impossible physical values, extreme Z-score spikes (&gt;4&sigma;), sensor flatlines (&gt;25 points), and depth gaps.
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
            <h3 className="text-lg font-bold text-white mb-2">ML Data Imputation</h3>
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
  );
}
