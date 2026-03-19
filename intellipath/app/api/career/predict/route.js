import { NextResponse } from "next/server";
import { predictCareers } from "@/actions/career";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const skills = Array.isArray(body.skills) ? body.skills : undefined;

    const result = await predictCareers(skills);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Career prediction error:", error);
    const message = error?.message || "Failed to predict careers";
    const status = message === "Unauthorized" ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

