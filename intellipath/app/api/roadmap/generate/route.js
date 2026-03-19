import { NextResponse } from "next/server";
import { generateRoadmap } from "@/actions/career";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const careerId = body.careerId || null;

    const result = await generateRoadmap(careerId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Roadmap generation error:", error);
    const message = error?.message || "Failed to generate roadmap";
    const status = message === "Unauthorized" ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

