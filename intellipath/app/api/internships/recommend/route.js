import { NextResponse } from "next/server";
import { recommendInternships } from "@/actions/career";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const careerId = searchParams.get("careerId");

    const internships = await recommendInternships(careerId || null);

    return NextResponse.json({ internships });
  } catch (error) {
    console.error("Internship recommendation error:", error);
    const message = error?.message || "Failed to recommend internships";
    const status = message === "Unauthorized" ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

