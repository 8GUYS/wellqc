with open("src/components/ui/header.tsx", "r", encoding="utf-8") as f:
    h = f.read()

old_h_left = """      {/* Left section: Mobile toggle */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>"""

new_h_left = """      {/* Left section: Mobile toggle & Brand */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <Link href="/dashboard" className="md:hidden flex items-center space-x-1.5">
          <span className="font-extrabold text-xs text-white tracking-wider flex items-center gap-1 font-mono">
            <span className="text-cyan-400">WellQC</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">STUDIO</span>
          </span>
        </Link>
      </div>"""

assert old_h_left in h, "old_h_left not found"
h = h.replace(old_h_left, new_h_left, 1)

old_h_pop = '<div className="absolute right-0 mt-1.5 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 text-slate-200 font-mono">'
new_h_pop = '<div className="absolute right-0 mt-1.5 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 text-slate-200 font-mono">'

assert old_h_pop in h, "old_h_pop not found"
h = h.replace(old_h_pop, new_h_pop, 1)

with open("src/components/ui/header.tsx", "w", encoding="utf-8") as f:
    f.write(h)

print("Updated header.tsx")

with open("src/components/theme/theme-switcher.tsx", "r", encoding="utf-8") as f:
    s = f.read()

old_s_pop = '<div className="absolute right-0 mt-2 w-80 bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-2xl p-2.5 z-50 text-slate-800 dark:text-slate-200 font-mono animate-in fade-in zoom-in-95 duration-100 max-h-[82vh] overflow-y-auto">'
new_s_pop = '<div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-2xl p-2.5 z-50 text-slate-800 dark:text-slate-200 font-mono animate-in fade-in zoom-in-95 duration-100 max-h-[82vh] overflow-y-auto">'

assert old_s_pop in s, "old_s_pop not found"
s = s.replace(old_s_pop, new_s_pop, 1)

with open("src/components/theme/theme-switcher.tsx", "w", encoding="utf-8") as f:
    f.write(s)

print("Updated theme-switcher.tsx")

