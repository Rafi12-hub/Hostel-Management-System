import React from "react";
import { GateScannerPanel } from "@/components/security/GateScannerPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useDemoAuth } from "@/context/DemoAuthContext";

export default function GateScanner() {
  const { user } = useDemoAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-4">
      <PageHeader
        title="Gate Security Scanner"
        subtitle="Face + QR verification with blink liveness & audit logging"
      />
      <GateScannerPanel securityUser={{ name: user?.name, id: user?.id || user?.studentId || "" }} />
    </div>
  );
}