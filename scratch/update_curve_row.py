with open("src/components/well-log/log-viewer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_row = """                          <div className="flex items-center space-x-2.5 truncate">
                            {/* Checkbox */}
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected
                                  ? "bg-cyan-500 border-cyan-400 text-slate-950"
                                  : "border-slate-600 group-hover:border-slate-400 bg-wellqc-panel"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            {/* Color indicator dot */}
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: meta?.colorDark || "#06b6d4" }}
                            />

                            {/* Curve Name & Info */}
                            <div className="truncate">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono font-bold text-xs text-white">
                                  {key}
                                </span>
                                {meta?.unit && meta.unit !== "—" && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    [{meta.unit}]
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate max-w-[170px] font-sans">
                                {meta?.name || key}
                              </p>
                            </div>
                          </div>"""

new_row = """                          <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                            {/* Checkbox */}
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected
                                  ? "bg-cyan-500 border-cyan-400 text-slate-950"
                                  : "border-slate-600 group-hover:border-slate-400 bg-wellqc-panel"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            {/* Color indicator dot */}
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: meta?.colorDark || "#06b6d4" }}
                            />

                            {/* Curve Name & Info */}
                            <div className="min-w-0 flex-1 truncate">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono font-bold text-xs text-white">
                                  {key}
                                </span>
                                {meta?.unit && meta.unit !== "—" && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    [{meta.unit}]
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate font-sans">
                                {meta?.name || key}
                              </p>
                            </div>
                          </div>"""

assert old_row in c, "old_row not found"
c = c.replace(old_row, new_row, 1)

with open("src/components/well-log/log-viewer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated curve item row")

