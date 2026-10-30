with open("src/components/well-log/log-viewer.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Update Gamma Ray minVal/maxVal and ticks in log-viewer.tsx
old_gr_block = """      } else if (std.standardMnemonic === "GR" || std.category === "GAMMA") {
        minVal = 0;
        maxVal = ext.hasData && ext.max > 150 ? Math.ceil(ext.max / 50) * 50 : 150;
      }"""

new_gr_block = """      } else if (std.standardMnemonic === "GR" || std.category === "GAMMA") {
        minVal = 0;
        maxVal = 150;
      }"""

assert old_gr_block in text, "old_gr_block not found in log-viewer.tsx"
text = text.replace(old_gr_block, new_gr_block, 1)

old_ticks_block = """      const isLogScale = isResistivity;
      const ticks = isLogScale
        ? [0.2, 2, 20, 200, 2000]
        : [
            minVal,
            Number(((minVal + maxVal) / 2).toFixed(minVal < 2 ? 2 : 0)),
            maxVal,
          ];"""

new_ticks_block = """      const isLogScale = isResistivity;
      const isGamma = std.standardMnemonic === "GR" || std.category === "GAMMA";
      const ticks = isLogScale
        ? [0.2, 2, 20, 200, 2000]
        : isGamma
        ? [0, 100, 150]
        : [
            minVal,
            Number(((minVal + maxVal) / 2).toFixed(minVal < 2 ? 2 : 0)),
            maxVal,
          ];"""

assert old_ticks_block in text, "old_ticks_block not found in log-viewer.tsx"
text = text.replace(old_ticks_block, new_ticks_block, 1)

with open("src/components/well-log/log-viewer.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Updated log-viewer.tsx successfully")

# 2. Also update cleaned-log-viewer.tsx for consistency
with open("src/components/well-log/cleaned-log-viewer.tsx", "r", encoding="utf-8") as f:
    c_text = f.read()

old_c_ticks = """              <div className="flex justify-between text-[11px] font-mono px-2 pt-1 border-t border-slate-300 mt-1">
                <span>{track1Config.min}</span>
                <span>{track1Config.max}</span>
              </div>"""

new_c_ticks = """              <div className="flex justify-between text-[11px] font-mono px-2 pt-1 border-t border-slate-300 mt-1">
                <span>{track1Config.min}</span>
                <span>100</span>
                <span>{track1Config.max}</span>
              </div>"""

if old_c_ticks in c_text:
    c_text = c_text.replace(old_c_ticks, new_c_ticks, 1)
    with open("src/components/well-log/cleaned-log-viewer.tsx", "w", encoding="utf-8") as f:
        f.write(c_text)
    print("Updated cleaned-log-viewer.tsx successfully")

