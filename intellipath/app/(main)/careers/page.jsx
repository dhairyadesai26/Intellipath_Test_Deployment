export const dynamic = "force-dynamic";

import { predictCareers } from "@/actions/career";
import { CareerCard } from "@/components/ui/career-card";

export default async function CareerRecommendationsPage() {
  const result = await predictCareers();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-2 items-center justify-between mb-2">
        <h1 className="text-6xl font-bold gradient-title">
          Career Recommendations
        </h1>
        <p className="text-sm text-muted-foreground max-w-md text-center md:text-right">
          Based on your profile skills, these are the top career paths that
          align with your strengths.
        </p>
      </div>

      {result.careers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          We could not find matching careers yet. Make sure your profile
          includes your key skills and try again after an admin has configured
          the career dataset.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.careers.map((career) => (
            <CareerCard key={career.id} career={career} />
          ))}
        </div>
      )}
    </div>
  );
}

