"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shows a friendly "AI is generating your data" banner.
 * Auto-refreshes the page every 12 seconds so the user doesn't have to wait.
 */
export function GeneratingBanner({ message }) {
  const router = useRouter();

  // Auto-refresh every 12 seconds
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <Loader2 className="h-6 w-6 text-primary animate-spin shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="font-semibold text-sm">Generating your personalised data…</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">This page will refresh automatically.</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => router.refresh()}
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Refresh now
      </Button>
    </div>
  );
}
