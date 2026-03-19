import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import AdminPanel from "./_component/admin-panel";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) return false;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  console.log("Admin Check:", {
    userEmail: user.email?.toLowerCase(),
    adminEmails,
    isMatch: adminEmails.includes(user.email?.toLowerCase()),
  });

  return adminEmails.includes(user.email?.toLowerCase());
}

export default async function AdminPage() {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <div className="space-y-4">
        <h1 className="text-6xl font-bold gradient-title">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this page. Contact an admin to
          grant you access via the{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            ADMIN_EMAILS
          </code>{" "}
          environment variable.
        </p>
      </div>
    );
  }

  // Pre-fetch data for initial render
  const [careers, skills, internships] = await Promise.all([
    db.career.findMany({
      include: { careerSkills: { include: { skill: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.skill.findMany({ orderBy: { name: "asc" } }),
    db.internship.findMany({
      include: { career: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-2 items-center justify-between mb-2">
        <div>
          <h1 className="text-6xl font-bold gradient-title">Admin Panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage careers, skills, and internship listings for the IntelliPath
            dataset.
          </p>
        </div>
      </div>

      <AdminPanel
        initialCareers={careers}
        initialSkills={skills}
        initialInternships={internships}
      />
    </div>
  );
}
