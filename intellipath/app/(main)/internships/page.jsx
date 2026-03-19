export const dynamic = "force-dynamic";

import { recommendInternships } from "@/actions/career";
import { InternshipCard } from "@/components/ui/internship-card";

export default async function InternshipSuggestionsPage() {
  const internships = await recommendInternships(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-2 items-center justify-between mb-2">
        <h1 className="text-6xl font-bold gradient-title">
          Internship Suggestions
        </h1>
        <p className="text-sm text-muted-foreground max-w-md text-center md:text-right">
          Discover internships that align with your predicted career path and
          current skill profile.
        </p>
      </div>

      {internships.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No internships are available yet. Once admins add internship listings
          mapped to careers, they will appear here.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {internships.map((internship) => (
            <InternshipCard key={internship.id} internship={internship} />
          ))}
        </div>
      )}
    </div>
  );
}

