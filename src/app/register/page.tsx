import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#e7eef4] dark:bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-400">
          Loading Workstation Portal...
        </div>
      }
    >
      <AuthForm mode="register" />
    </Suspense>
  );
}
