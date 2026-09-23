"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  CheckCircle2,
  Sparkles,
  CreditCard,
  Building2,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
  Lock,
  RotateCcw,
  Check,
  LogIn,
} from "lucide-react";
import { PAYSTACK_PLANS, PaymentCurrency } from "@/lib/paystack";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: "pro_monthly" | "pro_annual" | "enterprise";
  onSuccess?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  defaultPlan = "pro_monthly",
  onSuccess,
}: PaymentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlan);
  const [currency, setCurrency] = useState<PaymentCurrency>("NGN");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [isDemoSigningIn, setIsDemoSigningIn] = useState(false);

  // Payment Runner Stages: "selection" | "processing_demo" | "success"
  const [paymentStage, setPaymentStage] = useState<"selection" | "processing_demo" | "success">("selection");
  const [demoStep, setDemoStep] = useState<number>(1);
  const [demoStatusText, setDemoStatusText] = useState<string>("");
  const [successDetails, setSuccessDetails] = useState<{
    planName: string;
    amount: string;
    reference: string;
    channel: string;
  } | null>(null);

  // Ensure portal target (document.body) is available on client.
  // This is one of the few legitimate uses of setState-in-effect: `document`
  // does not exist during the server render pass, so we can't compute this
  // value during render itself — it must be detected after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe portal mount check, cannot be derived during render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset stage and error state when the modal opens.
  // Adjusted directly during render (comparing against the previous value)
  // instead of in an effect, per React's recommended
