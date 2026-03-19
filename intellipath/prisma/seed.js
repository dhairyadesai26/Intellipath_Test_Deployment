/**
 * Prisma Seed Script
 * Run: node prisma/seed.js
 *
 * Seeds the IntelliPath dataset with sample careers, skills, and internships.
 * Safe to re-run: uses upsert / skipDuplicates so existing data is not duplicated.
 */

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const SKILLS = [
  { name: "javascript", category: "Programming Language" },
  { name: "typescript", category: "Programming Language" },
  { name: "python", category: "Programming Language" },
  { name: "java", category: "Programming Language" },
  { name: "react", category: "Frontend Framework" },
  { name: "nextjs", category: "Frontend Framework" },
  { name: "nodejs", category: "Backend Runtime" },
  { name: "sql", category: "Database" },
  { name: "postgresql", category: "Database" },
  { name: "mongodb", category: "Database" },
  { name: "docker", category: "DevOps" },
  { name: "kubernetes", category: "DevOps" },
  { name: "git", category: "Version Control" },
  { name: "machine learning", category: "AI / ML" },
  { name: "deep learning", category: "AI / ML" },
  { name: "data analysis", category: "Data Science" },
  { name: "figma", category: "Design" },
  { name: "ui/ux design", category: "Design" },
  { name: "rest api", category: "Backend" },
  { name: "linux", category: "System" },
];

const CAREERS = [
  {
    title: "Full Stack Developer",
    slug: "full-stack-developer",
    description:
      "Build end-to-end web applications, working across the frontend and backend stack.",
    industry: "Technology",
    level: "Mid",
    skills: ["javascript", "typescript", "react", "nodejs", "sql", "git", "rest api"],
  },
  {
    title: "Data Scientist",
    slug: "data-scientist",
    description:
      "Analyse complex datasets and build machine learning models to drive business decisions.",
    industry: "Technology",
    level: "Mid",
    skills: ["python", "machine learning", "deep learning", "data analysis", "sql", "git"],
  },
  {
    title: "UI/UX Designer",
    slug: "ui-ux-designer",
    description:
      "Design intuitive user interfaces and experiences for web and mobile products.",
    industry: "Design",
    level: "Entry",
    skills: ["figma", "ui/ux design", "javascript", "react"],
  },
  {
    title: "DevOps Engineer",
    slug: "devops-engineer",
    description:
      "Automate infrastructure, manage CI/CD pipelines, and keep production systems reliable.",
    industry: "Technology",
    level: "Mid",
    skills: ["docker", "kubernetes", "linux", "git", "python", "postgresql"],
  },
  {
    title: "Machine Learning Engineer",
    slug: "ml-engineer",
    description:
      "Design, train, and deploy machine learning models at production scale.",
    industry: "AI",
    level: "Senior",
    skills: ["python", "machine learning", "deep learning", "docker", "sql", "git"],
  },
];

const INTERNSHIPS = [
  {
    title: "Frontend Engineering Intern",
    company: "TechVentures Inc.",
    location: "San Francisco, CA",
    applyUrl: "https://example.com/apply/frontend-intern",
    description:
      "Join our product team to build beautiful, responsive React interfaces.",
    isRemote: false,
    careerSlug: "full-stack-developer",
  },
  {
    title: "Data Science Intern",
    company: "Analytics Co.",
    location: "New York, NY",
    applyUrl: "https://example.com/apply/data-science-intern",
    description:
      "Work with our data team to run experiments and build predictive models.",
    isRemote: true,
    careerSlug: "data-scientist",
  },
  {
    title: "Product Design Intern",
    company: "DesignFirst Studio",
    location: "Remote",
    applyUrl: "https://example.com/apply/design-intern",
    description:
      "Help shape the UX of consumer-facing apps used by millions.",
    isRemote: true,
    careerSlug: "ui-ux-designer",
  },
  {
    title: "DevOps / Platform Intern",
    company: "CloudBase",
    location: "Austin, TX",
    applyUrl: "https://example.com/apply/devops-intern",
    description:
      "Gain hands-on experience with Kubernetes, Terraform, and modern CI/CD tooling.",
    isRemote: false,
    careerSlug: "devops-engineer",
  },
  {
    title: "ML Engineering Intern",
    company: "Neural Networks Ltd.",
    location: "Remote",
    applyUrl: "https://example.com/apply/ml-intern",
    description:
      "Train and optimise large-scale models in a research-driven environment.",
    isRemote: true,
    careerSlug: "ml-engineer",
  },
];

async function main() {
  console.log("🌱 Seeding IntelliPath dataset...\n");

  // 1. Upsert skills
  console.log(`  Creating ${SKILLS.length} skills...`);
  const skillMap = {};
  for (const s of SKILLS) {
    const skill = await db.skill.upsert({
      where: { name: s.name },
      update: { category: s.category },
      create: s,
    });
    skillMap[s.name] = skill.id;
  }
  console.log("  ✓ Skills done");

  // 2. Upsert careers + career-skill mappings
  console.log(`\n  Creating ${CAREERS.length} careers...`);
  const careerMap = {};
  for (const c of CAREERS) {
    const { skills: careerSkillNames, ...careerData } = c;

    const career = await db.career.upsert({
      where: { slug: c.slug },
      update: {
        title: careerData.title,
        description: careerData.description,
        industry: careerData.industry,
        level: careerData.level,
      },
      create: careerData,
    });
    careerMap[c.slug] = career.id;

    // Map skills to career (skip if already exists)
    for (const skillName of careerSkillNames) {
      const skillId = skillMap[skillName];
      if (!skillId) {
        console.warn(`    ⚠ Skill not found: "${skillName}" — skipping`);
        continue;
      }
      await db.careerSkill
        .create({
          data: { careerId: career.id, skillId },
        })
        .catch(() => {}); // ignore unique constraint violations on re-run
    }
    console.log(`    ✓ ${career.title}`);
  }

  // 3. Upsert internships
  console.log(`\n  Creating ${INTERNSHIPS.length} internship listings...`);
  for (const i of INTERNSHIPS) {
    const { careerSlug, ...internshipData } = i;
    const careerId = careerMap[careerSlug];

    // Check if listing already exists by title + company
    const existing = await db.internship.findFirst({
      where: { title: internshipData.title, company: internshipData.company },
    });

    if (existing) {
      console.log(`    ⟳ Already exists: "${internshipData.title}"`);
      continue;
    }

    await db.internship.create({
      data: {
        ...internshipData,
        career: careerId ? { connect: { id: careerId } } : undefined,
      },
    });
    console.log(`    ✓ ${internshipData.title} @ ${internshipData.company}`);
  }

  console.log("\n✅ Seed complete!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
