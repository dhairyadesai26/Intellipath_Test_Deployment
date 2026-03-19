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

    const internships = await db.internship.findMany({
      include: {
        career: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ internships });
  } catch (error) {
    console.error("Admin internships GET error:", error);
    const message = error?.message || "Failed to fetch internships";
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
      company,
      location,
      applyUrl,
      description,
      isRemote,
      careerId,
    } = body;

    const internship = await db.internship.create({
      data: {
        title,
        company,
        location,
        applyUrl,
        description,
        isRemote: Boolean(isRemote),
        career: careerId ? { connect: { id: careerId } } : undefined,
      },
      include: {
        career: true,
      },
    });

    return NextResponse.json({ internship });
  } catch (error) {
    console.error("Admin internships POST error:", error);
    const message = error?.message || "Failed to create internship";
    const status =
      error.status || (message === "Unauthorized" ? 401 : 500);

    return NextResponse.json({ error: message }, { status });
  }
}

