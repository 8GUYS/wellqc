import { ParsedLAS } from "@/lib/las/parser";

interface HeadersTabProps {
  parsedLAS: ParsedLAS;
}

export function HeadersTab({ parsedLAS }: HeadersTabProps) {
  return (
    <div className="p-5 space-y-6">
      <div>
        <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider mb-3">
          ~WELL Information Block
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Well Name (WELL)</span>
            <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.wellName || "—"}</span>
          </div>
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Operating Company (COMP)</span>
            <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.company || "—"}</span>
          </div>
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Field Name (FLD)</span>
            <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.field || "—"}</span>
          </div>
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Unique Well Identifier (API/UWI)</span>
            <span className="font-bold text-white truncate block">{parsedLAS.wellInfo.apiUwi || "—"}</span>
          </div>
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Start Depth (STRT)</span>
            <span className="font-bold text-white">{parsedLAS.wellInfo.startDepth} {parsedLAS.wellInfo.depthUnit}</span>
          </div>
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Stop Depth (STOP)</span>
            <span className="font-bold text-white">{parsedLAS.wellInfo.stopDepth} {parsedLAS.wellInfo.depthUnit}</span>
          </div>
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Sampling Step (STEP)</span>
            <span className="font-bold text-white">{parsedLAS.wellInfo.step}</span>
          </div>
          <div className="bg-wellqc-card/60 p-3 rounded-lg border border-wellqc-border">
            <span className="text-[10px] text-wellqc-muted uppercase block">Null Value (NULL)</span>
            <span className="font-bold text-white">{parsedLAS.wellInfo.nullValue}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider mb-3">
          ~CURVE Header Declarations ({parsedLAS.curves.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
          {parsedLAS.curves.map((curve) => (
            <div key={curve.mnemonic} className="bg-wellqc-card/40 p-2.5 rounded-lg border border-wellqc-border flex items-center justify-between">
              <div>
                <span className="font-bold text-cyan-300">{curve.mnemonic}</span>
                <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">{curve.description || "Curve channel"}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-wellqc-panel border border-wellqc-border text-slate-300">
                {curve.unit || "unitless"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
