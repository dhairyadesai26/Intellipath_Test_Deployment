import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function RoadmapTimeline({ steps }) {
  if (!steps?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Learning Roadmap</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No roadmap generated yet. Generate a roadmap from your career
            recommendations or skill gap analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Learning Roadmap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {steps.map((entry, index) => (
          <div key={entry.skill} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary text-xs flex items-center justify-center text-primary-foreground">
                {index + 1}
              </div>
              <p className="font-medium capitalize">{entry.skill}</p>
            </div>
            <ol className="border-l border-border ml-3 pl-4 space-y-3">
              {Array.isArray(entry.steps) ? entry.steps.map((step) => (
                <li key={step.order || step.title} className="space-y-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              )) : (
                <li className="text-sm text-muted-foreground">No specific steps available.</li>
              )}
            </ol>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

