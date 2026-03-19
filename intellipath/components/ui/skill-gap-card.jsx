import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function SkillGapCard({ requiredSkills, matchedSkills, missingSkills }) {
  const total = requiredSkills.length || 0;
  const matched = matchedSkills.length || 0;
  const completion = total ? Math.round((matched / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Skill Gap Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Overall readiness</span>
            <span>{completion}%</span>
          </div>
          <Progress value={completion} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Required skills
            </p>
            <div className="flex flex-wrap gap-1">
              {requiredSkills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              You already have
            </p>
            <div className="flex flex-wrap gap-1">
              {matchedSkills.length ? (
                matchedSkills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No overlapping skills yet.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Missing skills
            </p>
            <div className="flex flex-wrap gap-1">
              {missingSkills.length ? (
                missingSkills.map((skill) => (
                  <Badge key={skill} variant="destructive">
                    {skill}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  You meet all required skills.
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

