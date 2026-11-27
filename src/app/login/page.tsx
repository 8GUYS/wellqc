import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#e7eef4] dark:bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-400">
          Loading Workstation Portal...
        </div>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
