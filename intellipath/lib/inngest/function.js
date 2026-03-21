import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

function normalizeSkills(skills) {
  return (skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function generateLearningStepsForSkill(skillName) {
  const base = skillName.trim();
  return [
    {
      title: `Understand ${base} fundamentals`,
      description: `Spend 3–5 hours going through beginner-friendly tutorials and official documentation for ${base}. Focus on core concepts and terminology.`,
      order: 1,
    },
    {
      title: `Build a small project with ${base}`,
      description: `Implement a small, practical project where you apply ${base} in a real-world context. Aim to cover at least 2–3 core use cases.`,
      order: 2,
    },
    {
      title: `Deep dive and advanced practice`,
      description: `Explore advanced topics in ${base}, complete practice challenges, and refactor your project to follow best practices.`,
      order: 3,
    },
  ];
}

/** Call Gemini and parse a JSON response safely */
async function callGeminiJSON(prompt) {
  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // Attempt to extract JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      text = match[1].trim();
    } else {
      // Fallback: strip any remaining backticks if no closed block is found
      text = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini JSON parse error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing: Weekly industry insights refresh
// ─────────────────────────────────────────────────────────────────────────────
export const generateIndustryInsights = inngest.createFunction(
  { id: "generate-industry-insights", name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" },
  async ({ event, step }) => {
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({ select: { industry: true } });
    });

    for (const { industry } of industries) {
      const prompt = `
        Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
        {
          "salaryRanges": [{ "role": "string", "min": number, "max": number, "median": number, "location": "string" }],
          "growthRate": number,
          "demandLevel": "High" | "Medium" | "Low",
          "topSkills": ["skill1", "skill2"],
          "marketOutlook": "Positive" | "Neutral" | "Negative",
          "keyTrends": ["trend1", "trend2"],
          "recommendedSkills": ["skill1", "skill2"]
        }
        IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
        Include at least 5 common roles for salary ranges. Growth rate should be a percentage. Include at least 5 skills and trends.
      `;

      const res = await step.ai.wrap(
        "gemini",
        async (p) => model.generateContent(p),
        prompt
      );

      const text = res.response.candidates[0].content.parts[0].text || "";
      const insights = JSON.parse(text.replace(/```(?:json)?\n?/g, "").trim());

      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            ...insights,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Existing: Rule-based career scoring (kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────
export const scoreCareers = inngest.createFunction(
  { id: "score-careers", name: "Score Careers for User" },
  { event: "career/score" },
  async ({ event, step }) => {
    const { userId } = event.data;
    const user = await step.run("Fetch user", () =>
      db.user.findUnique({ where: { id: userId }, select: { id: true, skills: true } })
    );
    if (!user) return;

    const userSkills = normalizeSkills(user.skills);
    if (!userSkills.length) return;

    const careers = await step.run("Fetch careers", () =>
      db.career.findMany({ include: { careerSkills: { include: { skill: true } } } })
    );

    const scored = careers
      .map((career) => {
        const requiredSkills = Array.from(
          new Set(career.careerSkills.map((cs) => cs.skill.name.trim().toLowerCase()))
        );
        const matchedSkills = requiredSkills.filter((s) => userSkills.includes(s));
        const matchScore = requiredSkills.length === 0 ? 0 : matchedSkills.length / requiredSkills.length;
        return { career, matchScore, matchedSkills, requiredSkills };
      })
      .filter((i) => i.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    if (!scored.length) return;

    await step.run("Persist predictions", () =>
      db.$transaction(
        scored.map((item) =>
          db.prediction.create({
            data: { userId: user.id, careerId: item.career.id, matchScore: item.matchScore },
          })
        )
      )
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Existing: Rule-based roadmap background job (kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────
export const generateRoadmapBackground = inngest.createFunction(
  { id: "generate-roadmap", name: "Generate Learning Roadmap" },
  { event: "roadmap/generate" },
  async ({ event, step }) => {
    const { userId, careerId } = event.data;
    const user = await step.run("Fetch user", () =>
      db.user.findUnique({ where: { id: userId }, select: { id: true, skills: true } })
    );
    if (!user) return;

    const career = await step.run("Fetch career", () =>
      db.career.findUnique({
        where: { id: careerId },
        include: { careerSkills: { include: { skill: true } } },
      })
    );
    if (!career) return;

    const userSkills = normalizeSkills(user.skills);
    const requiredSkills = Array.from(
      new Set(career.careerSkills.map((cs) => cs.skill.name.trim().toLowerCase()))
    );
    const missingSkills = requiredSkills.filter((s) => !userSkills.includes(s));
    const steps = missingSkills.map((skill) => ({ skill, steps: generateLearningStepsForSkill(skill) }));

    await step.run("Upsert roadmap", () =>
      db.roadmap.upsert({
        where: { userId_careerId: { userId: user.id, careerId: career.id } },
        update: { steps },
        create: { userId: user.id, careerId: career.id, steps },
      })
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// NEW: IntelliPath — Full AI Career Data Generation
// Event: intellipath/career.generate  data: { userId: string }
//
// Steps:
//  1. Fetch user profile
//  2. AI  → Generate 5 personalised careers
//  3.      → Upsert Careers + Skills + CareerSkill mappings
//  4. AI  → Generate 3 internship listings for top career
//  5.      → Upsert Internships
//  6. AI  → Score & rank all careers with reasoning → save Predictions
//  7. AI  → Generate personalised roadmap → save Roadmap
// ─────────────────────────────────────────────────────────────────────────────
export const generateCareerDataForUser = inngest.createFunction(
  { id: "generate-career-data", name: "IntelliPath: Generate AI Career Data", retries: 2 },
  { event: "intellipath/career.generate" },
  async ({ event, step }) => {
    const { userId } = event.data;

    // ── 1. Fetch user profile ───────────────────────────────────────────────
    const user = await step.run("Fetch user profile", () =>
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, industry: true, skills: true, experience: true, bio: true },
      })
    );
    if (!user?.industry) return;

    const userSkills = normalizeSkills(user.skills);
    const { industry, experience = 0, bio = "" } = user;

    // ── 2. AI: Generate Careers ─────────────────────────────────────────────
    const careerData = await step.run("AI: Generate careers", async () => {
      const prompt = `
You are an expert AI career advisor. Generate exactly 5 realistic and relevant career paths for this user profile.

USER PROFILE:
- Industry: ${industry}
- Current Skills: ${userSkills.length ? userSkills.join(", ") : "none listed"}
- Experience: ${experience} years
- Bio: ${bio || "not provided"}

Return ONLY valid JSON (no markdown, no extra text):
{
  "careers": [
    {
      "title": "string",
      "slug": "string (kebab-case, unique globally, e.g. full-stack-developer)",
      "description": "string (2 clear sentences describing the role)",
      "industry": "string",
      "level": "Entry" or "Mid" or "Senior",
      "requiredSkills": ["lowercase skill 1", "lowercase skill 2"]
    }
  ]
}

Rules:
- requiredSkills: 5–8 lowercase skill strings per career
- Vary experience levels (Entry/Mid/Senior) across the 5 careers
- All careers must be directly relevant to the user's industry and background
`.trim();
      return callGeminiJSON(prompt);
    });

    const aiCareers = careerData?.careers ?? [];
    if (!aiCareers.length) return;

    // ── 3. Upsert Careers + Skills + CareerSkill mappings ───────────────────
    const upsertedCareers = await step.run(
      "Upsert careers, skills, mappings",
      async () => {
        const results = [];
        for (const c of aiCareers) {
          const career = await db.career.upsert({
            where: { slug: c.slug },
            update: { title: c.title, description: c.description, industry: c.industry, level: c.level },
            create: { title: c.title, slug: c.slug, description: c.description, industry: c.industry, level: c.level },
          });

          const skillNames = [];
          for (const raw of c.requiredSkills ?? []) {
            const name = raw.trim().toLowerCase();
            if (!name) continue;
            const skill = await db.skill.upsert({
              where: { name },
              update: {},
              create: { name, category: c.industry },
            });
            await db.careerSkill
              .create({ data: { careerId: career.id, skillId: skill.id } })
              .catch(() => { });
            skillNames.push(name);
          }

          results.push({ id: career.id, title: career.title, requiredSkills: skillNames });
        }
        return results;
      }
    );

    const topCareer = upsertedCareers[0];
    if (!topCareer) return;

    // ── 4. AI: Generate Internships ─────────────────────────────────────────
    const internshipData = await step.run("AI: Generate internships", async () => {
      const prompt = `
You are a job board assistant. Generate exactly 3 realistic internship listings for someone targeting the role of "${topCareer.title}" in the "${industry}" industry.

Return ONLY valid JSON (no markdown, no extra text):
{
  "internships": [
    {
      "title": "string",
      "company": "string (realistic company name, not a real company)",
      "location": "string (City, State or 'Remote')",
      "description": "string (2–3 sentences about responsibilities)",
      "applyUrl": "https://example.com/apply/unique-slug",
      "isRemote": true or false
    }
  ]
}

Rules:
- Include at least 1 remote internship
- Companies should be plausible startups or firms in ${industry}
- Titles should reflect entry-level positions
`.trim();
      return callGeminiJSON(prompt);
    });

    // ── 5. Upsert Internships ───────────────────────────────────────────────
    await step.run("Upsert internships", async () => {
      for (const i of internshipData?.internships ?? []) {
        const exists = await db.internship.findFirst({
          where: { title: i.title, company: i.company },
        });
        if (exists) continue;
        await db.internship.create({
          data: {
            title: i.title,
            company: i.company,
            location: i.location ?? "Remote",
            description: i.description,
            applyUrl: i.applyUrl ?? "https://example.com/apply",
            isRemote: i.isRemote ?? false,
            career: { connect: { id: topCareer.id } },
          },
        });
      }
    });

    // ── 6. AI: Score & Predict Careers ──────────────────────────────────────
    const predictionData = await step.run("AI: Score and predict careers", async () => {
      const careerList = upsertedCareers
        .map((c) => `- ${c.title} (requires: ${c.requiredSkills.join(", ")})`)
        .join("\n");

      const prompt = `
You are an expert career counsellor. Evaluate how well this user fits each of the career options below.

USER PROFILE:
- Industry: ${industry}
- Current Skills: ${userSkills.length ? userSkills.join(", ") : "none"}
- Experience: ${experience} years
- Bio: ${bio || "not provided"}

CANDIDATE CAREERS:
${careerList}

Score each career 0–100 based on profile fit.
Return ONLY valid JSON (no markdown, no extra text):
{
  "predictions": [
    {
      "careerTitle": "string (match exactly one title above)",
      "matchScore": number (0–100),
      "reasoning": "string (1–2 sentences explaining the score)",
      "matchedSkills": ["lowercase skill"],
      "missingSkills": ["lowercase skill"]
    }
  ]
}

Rules:
- Include ALL ${upsertedCareers.length} careers
- Factor in experience and bio, not just skill keywords
- Scores should be realistic and differentiated
`.trim();
      return callGeminiJSON(prompt);
    });

    await step.run("Save predictions", async () => {
      // Clear old predictions and roadmaps for this user to avoid duplicates from previous runs
      await db.prediction.deleteMany({ where: { userId } }).catch(() => { });
      await db.roadmap.deleteMany({ where: { userId } }).catch(() => { });

      for (const p of predictionData?.predictions ?? []) {
        const career = upsertedCareers.find(
          (c) => c.title.toLowerCase() === p.careerTitle?.toLowerCase()
        );
        if (!career) continue;
        const score = Math.min(100, Math.max(0, p.matchScore ?? 0)) / 100;
        await db.prediction.deleteMany({ where: { userId, careerId: career.id } }).catch(() => { });
        await db.prediction.create({
          data: { userId, careerId: career.id, matchScore: score },
        });
      }
    });

    // ── 7. AI: Generate Personalised Roadmap ────────────────────────────────
    const missingSkills = topCareer.requiredSkills.filter((s) => !userSkills.includes(s));

    if (!missingSkills.length) {
      await step.run("Save roadmap (all skills matched)", () =>
        db.roadmap.upsert({
          where: { userId_careerId: { userId, careerId: topCareer.id } },
          update: { steps: [] },
          create: { userId, careerId: topCareer.id, steps: [] },
        })
      );
      return;
    }

    const roadmapData = await step.run("AI: Generate personalised roadmap", async () => {
      const prompt = `
You are a personalized learning coach. Create a detailed, actionable learning roadmap for someone targeting the role of "${topCareer.title}".

USER PROFILE:
- Industry: ${industry}
- Experience: ${experience} years
- Bio: ${bio || "not provided"}
- Skills they ALREADY have: ${userSkills.join(", ") || "none"}
- Skills they NEED to learn: ${missingSkills.join(", ")}

Generate a step-by-step learning plan for EACH missing skill.
Return ONLY valid JSON (no markdown, no extra text):
{
  "roadmap": [
    {
      "skill": "lowercase skill name",
      "steps": [
        {
          "title": "string (clear action-oriented title)",
          "description": "string (specific, actionable, 2–3 sentences)",
          "resources": ["Resource Name – URL or platform"],
          "estimatedHours": number,
          "order": number
        }
      ]
    }
  ]
}

Rules:
- Each skill gets 3–4 learning steps ordered from beginner to advanced
- Resources must be real, well-known platforms (MDN, freeCodeCamp, Coursera, official docs, etc.)
- estimatedHours per step: 2–20 hours (realistic)
- Tailor difficulty to the user's experience level
`.trim();
      return callGeminiJSON(prompt);
    });

    await step.run("Save roadmap", () =>
      db.roadmap.upsert({
        where: { userId_careerId: { userId, careerId: topCareer.id } },
        update: { steps: roadmapData?.roadmap ?? [] },
        create: { userId, careerId: topCareer.id, steps: roadmapData?.roadmap ?? [] },
      })
    );

    // Revalidate Next.js cache for updated pages
    await step.run("Revalidate paths", async () => {
      revalidatePath("/dashboard");
      revalidatePath("/careers");
      revalidatePath("/skill-gap");
      revalidatePath("/internships");
      revalidatePath("/roadmap");
      return "Paths revalidated";
    });
  }
);
