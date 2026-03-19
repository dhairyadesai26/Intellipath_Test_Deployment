import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function InternshipCard({ internship }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{internship.title}</CardTitle>
            <CardDescription className="mt-1">
              {internship.company}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {internship.location && (
              <Badge variant="outline" className="text-xs">
                {internship.location}
              </Badge>
            )}
            {internship.isRemote && (
              <Badge variant="secondary" className="text-xs">
                Remote
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {internship.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {internship.description}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        {internship.career?.title && (
          <p className="text-xs text-muted-foreground">
            Path: {internship.career.title}
          </p>
        )}
        <Button size="sm" asChild>
          <a href={internship.applyUrl} target="_blank" rel="noreferrer">
            Apply
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

