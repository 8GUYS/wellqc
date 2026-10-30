with open("src/app/upload/page.tsx", "r", encoding="utf-8") as f:
    u = f.read()

old_sec = """            {/* Tabbed Detailed Analysis Inspector */}
            <section
              aria-label="Detailed Analysis Tabs"
              className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-lg"
            >
              <div className="flex items-center border-b border-wellqc-border bg-wellqc-card/40 px-4 overflow-x-auto">"""

new_sec = """            {/* Tabbed Detailed Analysis Inspector */}
            <section
              aria-label="Detailed Analysis Tabs"
              className="bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-lg"
            >
              <div className="flex items-center border-b border-wellqc-border bg-wellqc-card/40 px-4 overflow-x-auto rounded-t-2xl">"""

assert old_sec in u, "old_sec not found"
u = u.replace(old_sec, new_sec, 1)

with open("src/app/upload/page.tsx", "w", encoding="utf-8") as f:
    f.write(u)

print("Updated upload/page.tsx")

