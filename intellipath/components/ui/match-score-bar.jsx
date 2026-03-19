import React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function MatchScoreBar({ score, className }) {
  const percentage = Math.round((score || 0) * 100);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Match Score</span>
        <span>{percentage}%</span>
      </div>
      <Progress value={percentage} />
    </div>
  );
}

