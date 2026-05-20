"use server";

import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

function normalizeSkills(skills) {
  return (skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function callGeminiJSON(prompt) {
  const result = await model.generateContent(prompt);
  let text = result.response.text();
  // Strip markdown code fences if present
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    text = match[1].trim();
  } else {
    text = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
  }
  return JSON.parse(text);
}

/**
 * Core AI career data generation pipeline.
 * Called directly from updateUser in local dev (awaited).
 * In production, called by the Inngest function instead.
 */
export async function generateCareerDataDirect(userId) {
  console.log("🚀 generateCareerDataDirect START for userId:", userId);

  // ── Step 1: Fetch user ─────────────────────────────────────────────────────
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, industry: true, skills: true, experience: true, bio: true },
  });

  if (!user) { console.log("❌ user not found"); return; }
  if (!user.industry) { console.log("❌ user has no industry set"); return; }

  const userSkills = normalizeSkills(user.skills);
  const industry = user.industry;
  const experience = user.experience ?? 0;
  const bio = user.bio ?? "";

  console.log("👤 User profile:", { industry, experience, skills: userSkills });

  // ── Step 2: Clear old data immediately (so banner shows) ───────────────────
  await db.prediction.deleteMany({ where: { userId } });
  await db.roadmap.deleteMany({ where: { userId } });
  console.log("🗑️  Cleared old predictions and roadmaps");

  // ── Step 3: Generate 5 career paths ───────────────────────────────────────
  console.log("🤖 Calling Gemini for careers...");
  let careerData;
  try {
    careerData = await callGeminiJSON(`
You are an AI career advisor. Generate exactly 5 relevant career paths for this user.

Industry: ${industry}
Skills: ${userSkills.join(", ") || "none"}
Experience: ${experience} years

Return ONLY this JSON, no markdown:
{"careers":[{"title":"string","slug":"unique-kebab-case","description":"2 sentences","industry":"string","level":"Entry","requiredSkills":["skill1","skill2"]}]}

Rules: requiredSkills must be 5-8 lowercase strings. level must be Entry, Mid, or Senior.
    `.trim());
  } catch (err) {
    console.error("❌ Gemini career gen failed:", err.message);
    return;
  }

  const aiCareers = careerData?.careers ?? [];
  if (!aiCareers.length) { console.log("❌ Gemini returned 0 careers"); return; }
  console.log("✅ Got", aiCareers.length, "careers from Gemini");

  // ── Step 4: Upsert careers + skills + relationships ────────────────────────
  const upsertedCareers = [];
  for (const c of aiCareers) {
    const slug = (c.slug || c.title.toLowerCase().replace(/\s+/g, "-")).replace(/[^a-z0-9-]/g, "");
    const career = await db.career.upsert({
      where: { slug },
      update: { title: c.title, description: c.description, industry: c.industry || industry, level: c.level || "Mid" },
      create: { title: c.title, slug, description: c.description, industry: c.industry || industry, level: c.level || "Mid" },
    });

    const skillNames = [];
    for (const raw of c.requiredSkills ?? []) {
      const name = raw.trim().toLowerCase();
      if (!name) continue;
      const skill = await db.skill.upsert({
        where: { name },
        update: {},
        create: { name, category: industry },
      });
      await db.careerSkill.create({ data: { careerId: career.id, skillId: skill.id } }).catch(() => { });
      skillNames.push(name);
    }
    upsertedCareers.push({ id: career.id, title: career.title, requiredSkills: skillNames });
  }
  console.log("✅ Upserted", upsertedCareers.length, "careers to DB");

  const topCareer = upsertedCareers[0];
  if (!topCareer) return;

  // ── Step 5: Generate internships ───────────────────────────────────────────
  console.log("🤖 Calling Gemini for internships...");
  try {
    const internshipData = await callGeminiJSON(`
You are a job board assistant. Generate exactly 3 internship listings for a "${topCareer.title}" role in ${industry}.

Return ONLY this JSON, no markdown:
{"internships":[{"title":"string","company":"string","location":"string","description":"2 sentences","applyUrl":"https://example.com/apply/slug","isRemote":false}]}
    `.trim());

    for (const i of internshipData?.internships ?? []) {
      const exists = await db.internship.findFirst({ where: { title: i.title, company: i.company } });
      if (exists) continue;
      await db.internship.create({
        data: {
          title: i.title,
          company: i.company,
          location: i.location ?? "Remote",
          description: i.description,
          applyUrl: i.applyUrl ?? "https://example.com/apply",
          isRemote: !!i.isRemote,
          career: { connect: { id: topCareer.id } },
        },
      });
    }
    console.log("✅ Internships saved");
  } catch (err) {
    console.error("⚠️ Internship gen failed (non-fatal):", err.message);
  }

  // ── Step 6: Score & save career predictions ────────────────────────────────
  console.log("🤖 Calling Gemini for career scoring...");
  try {
    const careerList = upsertedCareers
      .map((c) => `- ${c.title} (needs: ${c.requiredSkills.join(", ")})`)
      .join("\n");

    const predictionData = await callGeminiJSON(`
You are a career counsellor. Score how well this user fits each career (0-100).

User: ${industry}, ${experience} yrs exp, skills: ${userSkills.join(", ") || "none"}

Careers:
${careerList}

Return ONLY this JSON, no markdown:
{"predictions":[{"careerTitle":"exact title from above","matchScore":75}]}

Include ALL ${upsertedCareers.length} careers with realistic, varied scores.
    `.trim());

    for (const p of predictionData?.predictions ?? []) {
      const career = upsertedCareers.find(
        (c) => c.title.toLowerCase() === (p.careerTitle ?? "").toLowerCase()
      );
      if (!career) continue;
      const score = Math.min(1, Math.max(0, (p.matchScore ?? 50) / 100));
      await db.prediction.create({ data: { userId, careerId: career.id, matchScore: score } });
    }
    console.log("✅ Predictions saved");
  } catch (err) {
    console.error("❌ Prediction scoring failed:", err.message);
    // Save default predictions so banner clears even if scoring fails
    for (const career of upsertedCareers) {
      await db.prediction.create({ data: { userId, careerId: career.id, matchScore: 0.5 } }).catch(() => { });
    }
    console.log("✅ Fallback predictions saved");
  }

  // ── Step 7: Generate learning roadmap ─────────────────────────────────────
  console.log("🤖 Calling Gemini for roadmap...");
  try {
    const missingSkills = topCareer.requiredSkills.filter((s) => !userSkills.includes(s));

    if (!missingSkills.length) {
      await db.roadmap.upsert({
        where: { userId_careerId: { userId, careerId: topCareer.id } },
        update: { steps: [] },
        create: { userId, careerId: topCareer.id, steps: [] },
      });
      console.log("✅ Roadmap saved (no missing skills)");
    } else {
      const roadmapData = await callGeminiJSON(`
Create a learning roadmap for "${topCareer.title}". Skills to learn: ${missingSkills.slice(0, 5).join(", ")}.

Return ONLY this JSON, no markdown:
{"roadmap":[{"skill":"skill name","steps":[{"title":"step title","description":"2 sentences","estimatedHours":5,"order":1}]}]}

Each skill: 3 steps, beginner to advanced.
      `.trim());

      await db.roadmap.upsert({
        where: { userId_careerId: { userId, careerId: topCareer.id } },
        update: { steps: roadmapData?.roadmap ?? [] },
        create: { userId, careerId: topCareer.id, steps: roadmapData?.roadmap ?? [] },
      });
      console.log("✅ Roadmap saved");
    }
  } catch (err) {
    console.error("⚠️ Roadmap gen failed (non-fatal):", err.message);
    await db.roadmap.upsert({
      where: { userId_careerId: { userId, careerId: topCareer.id } },
      update: { steps: [] },
      create: { userId, careerId: topCareer.id, steps: [] },
    }).catch(() => { });
  }

  // ── Step 8: Revalidate pages ───────────────────────────────────────────────
  try {
    revalidatePath("/dashboard");
    revalidatePath("/careers");
    revalidatePath("/skill-gap");
    revalidatePath("/internships");
    revalidatePath("/roadmap");
  } catch (_) { }

  console.log("🎉 generateCareerDataDirect COMPLETE for userId:", userId);
}
