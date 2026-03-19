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

    const skills = await db.skill.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ skills });
  } catch (error) {
    console.error("Admin skills GET error:", error);
    const message = error?.message || "Failed to fetch skills";
    const status =
      error.status || (message === "Unauthorized" ? 401 : 500);

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { name, category, description } = body;

    const skill = await db.skill.create({
      data: {
        name,
        category,
        description,
      },
    });

    return NextResponse.json({ skill });
  } catch (error) {
    console.error("Admin skills POST error:", error);
    const message = error?.message || "Failed to create skill";
    const status =
      error.status || (message === "Unauthorized" ? 401 : 500);

    return NextResponse.json({ error: message }, { status });
  }
}

