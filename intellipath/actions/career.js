"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

function normalizeSkills(skills) {
  return (skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export async function getCurrentUserWithSkills() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      skills: true,
      industry: true,
    },
  });

  if (!user) throw new Error("User not found");

  return user;
}

export async function predictCareers(inputSkills) {
  const user = await getCurrentUserWithSkills();

  const userSkills = normalizeSkills(
    Array.isArray(inputSkills) && inputSkills.length ? inputSkills : user.skills
  );

  if (!userSkills.length) {
    return {
      careers: [],
      userSkills: [],
    };
  }

  // Fetch AI-generated predictions for this user
  const predictions = await db.prediction.findMany({
    where: { userId: user.id },
    orderBy: { matchScore: "desc" },
    include: {
      career: {
        include: {
          careerSkills: {
            include: { skill: true }
          }
        }
      }
    },
    take: 5,
  });

  if (!predictions.length) {
    return { careers: [], userSkills };
  }

  return {
    careers: predictions.map((p) => {
      const requiredSkills = p.career.careerSkills.map((cs) =>
        cs.skill.name.trim().toLowerCase()
      );
      const uniqueRequired = Array.from(new Set(requiredSkills));

      const matchedSkills = uniqueRequired.filter((skill) =>
        userSkills.includes(skill)
      );

      return {
        id: p.career.id,
        title: p.career.title,
        slug: p.career.slug,
        description: p.career.description,
        industry: p.career.industry,
        level: p.career.level,
        matchScore: p.matchScore,
        matchedSkills,
        requiredSkills: uniqueRequired,
      };
    }),
    userSkills,
  };
}

export async function getSkillGap(careerId, inputSkills) {
  const user = await getCurrentUserWithSkills();

  const userSkills = normalizeSkills(
    Array.isArray(inputSkills) && inputSkills.length ? inputSkills : user.skills
  );

  if (!careerId) {
    // If career not specified, pick the top predicted career
    const prediction = await predictCareers(userSkills);
    const topCareer = prediction.careers[0];
    if (!topCareer) {
      return {
        career: null,
        userSkills,
        requiredSkills: [],
        missingSkills: [],
        matchedSkills: [],
      };
    }
    careerId = topCareer.id;
  }

  const career = await db.career.findUnique({
    where: { id: careerId },
    include: {
      careerSkills: {
        include: { skill: true },
      },
    },
  });

  if (!career) {
    throw new Error("Career not found");
  }

  const requiredSkills = career.careerSkills.map((cs) =>
    cs.skill.name.trim().toLowerCase()
  );
  const uniqueRequired = Array.from(new Set(requiredSkills));

  const matchedSkills = uniqueRequired.filter((skill) =>
    userSkills.includes(skill)
  );
  const missingSkills = uniqueRequired.filter(
    (skill) => !userSkills.includes(skill)
  );

  return {
    career: {
      id: career.id,
      title: career.title,
      slug: career.slug,
      description: career.description,
      industry: career.industry,
      level: career.level,
    },
    userSkills,
    requiredSkills: uniqueRequired,
    matchedSkills,
    missingSkills,
  };
}

// Called via Promise.all in generateRoadmap — async is required by "use server"
export async function generateLearningStepsForSkill(skillName) {
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

export async function generateRoadmap(careerId) {
  const user = await getCurrentUserWithSkills();
  const skillGap = await getSkillGap(careerId);

  if (!skillGap.career) {
    return null;
  }

  // Build roadmap steps – generateLearningStepsForSkill is declared async
  // so must be awaited inside the map to resolve the returned Promise.
  const roadmapSteps = await Promise.all(
    skillGap.missingSkills.map(async (skill) => ({
      skill,
      steps: await generateLearningStepsForSkill(skill),
    }))
  );

  const roadmap = await db.roadmap.upsert({
    where: {
      userId_careerId: {
        userId: user.id,
        careerId: skillGap.career.id,
      },
    },
    update: {
      steps: roadmapSteps,
    },
    create: {
      userId: user.id,
      careerId: skillGap.career.id,
      steps: roadmapSteps,
    },
  });

  return {
    career: skillGap.career,
    userSkills: skillGap.userSkills,
    missingSkills: skillGap.missingSkills,
    matchedSkills: skillGap.matchedSkills,
    steps: roadmapSteps,
    roadmapId: roadmap.id,
  };
}

export async function getRoadmapForUser(careerId) {
  const user = await getCurrentUserWithSkills();

  let targetCareerId = careerId;

  if (!targetCareerId) {
    const prediction = await predictCareers();
    const topCareer = prediction.careers[0];
    if (!topCareer) {
      return null;
    }
    targetCareerId = topCareer.id;
  }

  const roadmap = await db.roadmap.findFirst({
    where: {
      userId: user.id,
      careerId: targetCareerId,
    },
    include: {
      career: true,
    },
  });

  if (!roadmap) {
    return null;
  }

  const steps = Array.isArray(roadmap.steps) ? roadmap.steps : [];

  // Only treat as stale/corrupt if the first entry has `steps` that is
  // neither an array nor undefined — e.g. a serialised Promise object from
  // an earlier bug where generateLearningStepsForSkill was not awaited.
  // An empty steps array [] is valid (user already has all required skills).
  const firstSteps = steps[0]?.steps;
  if (firstSteps !== undefined && !Array.isArray(firstSteps)) {
    return null;
  }

  // Compute matchedSkills & missingSkills so the roadmap page can display them.
  const userSkills = normalizeSkills(user.skills);
  const careerWithSkills = await db.career.findUnique({
    where: { id: roadmap.career.id },
    include: { careerSkills: { include: { skill: true } } },
  });
  const requiredSkills = careerWithSkills
    ? Array.from(new Set(careerWithSkills.careerSkills.map((cs) => cs.skill.name.trim().toLowerCase())))
    : [];
  const matchedSkills = requiredSkills.filter((s) => userSkills.includes(s));
  const missingSkills = requiredSkills.filter((s) => !userSkills.includes(s));

  return {
    id: roadmap.id,
    career: roadmap.career,
    steps,
    matchedSkills,
    missingSkills,
    createdAt: roadmap.createdAt,
  };
}

export async function recommendInternships(careerId) {
  const user = await getCurrentUserWithSkills();

  let targetCareerId = careerId;

  if (!targetCareerId) {
    const prediction = await predictCareers();
    const topCareer = prediction.careers[0];
    if (!topCareer) {
      return [];
    }
    targetCareerId = topCareer.id;
  }

  const internships = await db.internship.findMany({
    where: {
      OR: [
        { careerId: targetCareerId },
        { careerId: null }, // generic internships
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return internships;
}

