import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email.toLowerCase())) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }

  return user;
}

export async function GET() {
  try {
    await requireAdmin();

    const careers = await db.career.findMany({
      include: {
        careerSkills: {
          include: { skill: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ careers });
  } catch (error) {
    console.error("Admin careers GET error:", error);
    const message = error?.message || "Failed to fetch careers";
    const status =
      error.status || (message === "Unauthorized" ? 401 : 500);

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req) {
  try {
    await requireAdmin();

    const body = await req.json();
    const {
      title,
      slug,
      description,
      industry,
      level,
      skillIds,
    } = body;

    const career = await db.career.create({
      data: {
        title,
        slug,
        description,
        industry,
        level,
        careerSkills: skillIds?.length
          ? {
              create: skillIds.map((skillId) => ({
                skill: { connect: { id: skillId } },
              })),
            }
          : undefined,
      },
      include: {
        careerSkills: {
          include: { skill: true },
        },
      },
    });

    return NextResponse.json({ career });
  } catch (error) {
    console.error("Admin careers POST error:", error);
    const message = error?.message || "Failed to create career";
    const status =
      error.status || (message === "Unauthorized" ? 401 : 500);

    return NextResponse.json({ error: message }, { status });
  }
}

