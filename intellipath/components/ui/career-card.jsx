import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchScoreBar } from "@/components/ui/match-score-bar";
import Link from "next/link";

export function CareerCard({ career }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{career.title}</CardTitle>
            {career.level && (
              <CardDescription className="mt-1 capitalize">
                {career.level} · {career.industry}
              </CardDescription>
            )}
          </div>
          {career.industry && (
            <Badge variant="outline" className="shrink-0">
              {career.industry}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        {career.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {career.description}
          </p>
        )}
        <MatchScoreBar score={career.matchScore} />
        {!!career.matchedSkills?.length && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Matched skills
            </p>
            <div className="flex flex-wrap gap-1">
              {career.matchedSkills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {career.requiredSkills?.length || 0} required skills
        </p>
        <Button size="sm" asChild>
          <Link href={`/roadmap?careerId=${career.id}`}>View Roadmap</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

