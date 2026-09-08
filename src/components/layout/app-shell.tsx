"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentRole, setCurrentRole] = useState("PETROPHYSICIST");
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    department: string;
    role?: string;
    tier?: string;
    freeChecksUsed?: number;
    ndaAcceptedAt?: string | null;
  } | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          if (active) router.replace("/login");
          return;
        }
        const { user } = await response.json();
        if (!active) return;

        // Option A: NDA Gatekeeper Enforcement
        // If user has not accepted NDA and is not currently on /nda, redirect to /nda
        if (!user.ndaAcceptedAt && pathname !== "/nda") {
          router.replace("/nda");
          return;
        }

        setCurrentRole(user.role || "PETROPHYSICIST");
        setCurrentUser({
          name: user.name,
          email: user.email,
          department: user.department || "Subsurface Analytics",
          role: user.role || "PETROPHYSICIST",
          tier: user.tier || "FREE",
          freeChecksUsed: user.freeChecksUsed ?? 0,
          ndaAcceptedAt: user.ndaAcceptedAt || null,
        });
      } catch {
        if (active) router.replace("/login");
      }
    }

    loadUser();

    function handleUserUpdated() {
      loadUser();
    }

    window.addEventListener("wellqc_user_updated", handleUserUpdated);
    return () => {
      active = false;
      window.removeEventListener("wellqc_user_updated", handleUserUpdated);
    };
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };


  if (!currentUser) return <div className="min-h-screen bg-wellqc-dark" />;

  return (
    <div className="flex min-h-screen bg-wellqc-dark">
      <Sidebar
        currentRole={currentRole}
        mobileOpen={mobileNavOpen}
        onCloseMobileNav={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          currentUser={currentUser}
          onLogout={handleLogout}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto bg-gradient-to-b from-wellqc-dark via-wellqc-dark to-[#080b11]">
          {children}
        </main>
      </div>
    </div>
  );
}
