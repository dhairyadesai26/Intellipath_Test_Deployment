"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";
import { generateCareerDataDirect } from "./generate-career-data";
import { inngest } from "@/lib/inngest/client";

export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // Always upsert the IndustryInsight — create if new industry, regenerate if editing
    // to a different industry so the dashboard always shows fresh, relevant data.
    const existingInsight = await db.industryInsight.findUnique({
      where: { industry: data.industry },
    });

    if (!existingInsight) {
      // New industry — generate insights from scratch
      const insights = await generateAIInsights(data.industry);
      await db.industryInsight.create({
        data: {
          industry: data.industry,
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (user.industry && user.industry !== data.industry) {
      // User changed their industry — refresh the insight for the new industry
      const insights = await generateAIInsights(data.industry);
      await db.industryInsight.update({
        where: { industry: data.industry },
        data: {
          ...insights,
          lastUpdated: new Date(),
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Parse skills: form sends a comma-separated string, DB needs String[]
    const skillsArray =
      typeof data.skills === "string"
        ? data.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        : data.skills ?? [];

    // Now update the user
    const updatedUser = await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        industry: data.industry,
        experience: parseInt(data.experience, 10),
        bio: data.bio,
        skills: skillsArray,
      },
    });

    // ── Career Data Generation ────────────────────────────────────────────────
    // Production (INNGEST_EVENT_KEY set): send event → Inngest Cloud runs the
    //   job without serverless timeout limits and with retries.
    // Local dev (no key): call directly so no Inngest dev server is needed.
    if (process.env.INNGEST_EVENT_KEY) {
      try {
        await inngest.send({
          name: "intellipath/career.generate",
          data: { userId: updatedUser.id },
        });
      } catch (inngestErr) {
        console.warn("⚠️ Inngest send failed, falling back to direct:", inngestErr.message);
        generateCareerDataDirect(updatedUser.id).catch((err) =>
          console.warn("⚠️ Career data generation failed:", err.message)
        );
      }
    } else {
      // Local dev: run directly (fire-and-forget)
      generateCareerDataDirect(updatedUser.id).catch((err) =>
        console.warn("⚠️ Career data generation failed:", err.message)
      );
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating user and industry:", error.message);
    throw new Error("Failed to update profile");
  }
}

export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
      select: {
        industry: true,
      },
    });

    return {
      isOnboarded: !!user?.industry,
    };
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    throw new Error("Failed to check onboarding status");
  }
}

export async function getUserProfile() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      industry: true,
      experience: true,
      bio: true,
      skills: true,
    },
  });

  return user;
}
