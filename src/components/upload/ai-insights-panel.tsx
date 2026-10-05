import { Sparkles } from "lucide-react";
import { AIAnalysisOutput } from "@/lib/las/ai-analyzer";

interface AIInsightsPanelProps {
  aiOutput: AIAnalysisOutput;
}

export function AIInsightsPanel({ aiOutput }: AIInsightsPanelProps) {
  return (
    <section
      aria-label="AI Interpretation"
      className="bg-wellqc-panel border border-cyan-500/30 rounded-2xl p-5 space-y-4 shadow-xl"
    >
      <div className="flex items-center space-x-2 text-sm font-bold text-cyan-300">
        <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
        <span>Petrophysical Interpretation &amp; Recommendations</span>
      </div>
      <p className="text-xs text-slate-200 leading-relaxed font-mono bg-wellqc-dark/60 p-4 rounded-xl border border-wellqc-border">
        {aiOutput.summary}
      </p>
      {aiOutput.recommendations.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-mono text-wellqc-muted uppercase font-bold">
            Recommended Engineering Actions:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {aiOutput.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-wellqc-card/60 border border-wellqc-border text-xs text-slate-300 font-mono"
              >
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
