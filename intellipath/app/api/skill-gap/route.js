import { NextResponse } from "next/server";
import { getSkillGap } from "@/actions/career";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const careerId = body.careerId || null;
    const skills = Array.isArray(body.skills) ? body.skills : undefined;

    const result = await getSkillGap(careerId, skills);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Skill gap analysis error:", error);
    const message = error?.message || "Failed to analyze skill gap";
    const status = message === "Unauthorized" ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

