import re

file_path = "src/components/well-log/log-viewer.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add dropdownAlign state and responsive positioning effect + touchstart support
old_state_block = """  // Dropdown selector state
  const [isTrackDropdownOpen, setIsTrackDropdownOpen] = useState(false);
  const [curveSearchQuery, setCurveSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTrackDropdownOpen(false);
      }
    }
    if (isTrackDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTrackDropdownOpen]);"""

new_state_block = """  // Dropdown selector state
  const [isTrackDropdownOpen, setIsTrackDropdownOpen] = useState(false);
  const [curveSearchQuery, setCurveSearchQuery] = useState("");
  const [dropdownAlign, setDropdownAlign] = useState<"left" | "right">("left");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine optimal dropdown alignment based on screen boundaries
  useEffect(() => {
    if (isTrackDropdownOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const popupWidth = 384;
      // If expanding to the right would overflow the screen and there's sufficient room on the left
      if (rect.left + popupWidth > window.innerWidth - 16 && rect.right >= popupWidth) {
        setDropdownAlign("right");
      } else {
        setDropdownAlign("left");
      }
    }
  }, [isTrackDropdownOpen]);

  // Close dropdown on click or touch outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTrackDropdownOpen(false);
      }
    }
    if (isTrackDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [isTrackDropdownOpen]);"""

assert old_state_block in content, "old_state_block not found in log-viewer.tsx"
content = content.replace(old_state_block, new_state_block, 1)

# 2. Update Top Action Toolbar and Popover positioning
old_popover_block = """      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-wellqc-panel border border-wellqc-border rounded-xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {wellName} — Wireline Subsurface Explorer
            </h3>
          </div>
          <p className="text-xs text-wellqc-muted font-mono mt-0.5">
            Depth Interval: {minDepth} – {maxDepth} {depthUnit} | {totalPoints.toLocaleString()} Recorded Samples
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* CURVE TRACKS DROPDOWN SELECTOR BUTTON */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsTrackDropdownOpen((prev) => !prev)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl font-bold bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-slate-200 hover:text-white transition-all shadow-inner"
              title="Select which curve tracks to display in the wireline log"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Curves:{" "}
                <span className="text-cyan-300 font-extrabold">
                  {selectedCurveKeys.length === 1
                    ? selectedCurveKeys[0]
                    : `${selectedCurveKeys.length}/${allCurveKeys.length} Active`}
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isTrackDropdownOpen ? "rotate-180 text-cyan-400" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu Popover */}
            {isTrackDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-wellqc-panel/95 backdrop-blur-xl border border-wellqc-border rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-wellqc-border animate-in fade-in zoom-in-95 duration-150">"""

new_popover_block = """      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-wellqc-panel border border-wellqc-border rounded-xl shadow-lg">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">
              {wellName} — Wireline Subsurface Explorer
            </h3>
          </div>
          <p className="text-[11px] sm:text-xs text-wellqc-muted font-mono mt-0.5 truncate">
            Depth Interval: {minDepth} – {maxDepth} {depthUnit} | {totalPoints.toLocaleString()} Recorded Samples
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs">
          {/* CURVE TRACKS DROPDOWN SELECTOR BUTTON */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsTrackDropdownOpen((prev) => !prev)}
              className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-slate-200 hover:text-white transition-all shadow-inner text-xs"
              title="Select which curve tracks to display in the wireline log"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Curves:{" "}
                <span className="text-cyan-300 font-extrabold">
                  {selectedCurveKeys.length === 1
                    ? selectedCurveKeys[0]
                    : `${selectedCurveKeys.length}/${allCurveKeys.length} Active`}
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isTrackDropdownOpen ? "rotate-180 text-cyan-400" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu Popover */}
            {isTrackDropdownOpen && (
              <div className={`absolute mt-2 w-[calc(100vw-2.5rem)] sm:w-96 max-w-[calc(100vw-2.5rem)] sm:max-w-md bg-wellqc-panel/95 backdrop-blur-xl border border-wellqc-border rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-wellqc-border animate-in fade-in zoom-in-95 duration-150 ${
                dropdownAlign === "right" ? "right-0" : "left-0"
              }`}>"""

assert old_popover_block in content, "old_popover_block not found in log-viewer.tsx"
content = content.replace(old_popover_block, new_popover_block, 1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Successfully updated log-viewer.tsx")

