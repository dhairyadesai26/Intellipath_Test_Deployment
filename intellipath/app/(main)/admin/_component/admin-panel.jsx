"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Careers Tab ──────────────────────────────────────────────────────────────

function CareersTab({ initialCareers, skills }) {
  const [careers, setCareers] = useState(initialCareers);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    industry: "",
    level: "",
    skillIds: [],
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/careers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create career");
      setCareers((prev) => [data.career, ...prev]);
      setForm({ title: "", slug: "", description: "", industry: "", level: "", skillIds: [] });
      toast.success(`Career "${data.career.title}" created successfully.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skillId) => {
    setForm((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(skillId)
        ? prev.skillIds.filter((id) => id !== skillId)
        : [...prev.skillIds, skillId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Add Career Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Career</CardTitle>
          <CardDescription>
            Define a career path and map required skills to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="career-title">Title *</Label>
                <Input
                  id="career-title"
                  placeholder="e.g. Full Stack Developer"
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      title: e.target.value,
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="career-slug">Slug *</Label>
                <Input
                  id="career-slug"
                  placeholder="full-stack-developer"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slug: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="career-industry">Industry</Label>
                <Input
                  id="career-industry"
                  placeholder="e.g. Technology"
                  value={form.industry}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, industry: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="career-level">Level</Label>
                <Input
                  id="career-level"
                  placeholder="Entry / Mid / Senior"
                  value={form.level}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, level: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="career-description">Description</Label>
              <Input
                id="career-description"
                placeholder="Short description of this career path"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>

            {/* skill picker */}
            {skills.length > 0 && (
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-border rounded-md">
                  {skills.map((skill) => {
                    const selected = form.skillIds.includes(skill.id);
                    return (
                      <Badge
                        key={skill.id}
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => toggleSkill(skill.id)}
                      >
                        {skill.name}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click badges to toggle required skills ({form.skillIds.length} selected)
                </p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Creating..." : "Create Career"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Career List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Existing Careers ({careers.length})
        </h3>
        {careers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No careers added yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {careers.map((career) => (
              <Card key={career.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{career.title}</p>
                  {career.level && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {career.level}
                    </Badge>
                  )}
                </div>
                {career.industry && (
                  <p className="text-xs text-muted-foreground">{career.industry}</p>
                )}
                {career.careerSkills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {career.careerSkills.map((cs) => (
                      <Badge key={cs.id} variant="secondary" className="text-xs">
                        {cs.skill.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skills Tab ───────────────────────────────────────────────────────────────

function SkillsTab({ initialSkills }) {
  const [skills, setSkills] = useState(initialSkills);
  const [form, setForm] = useState({ name: "", category: "", description: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create skill");
      setSkills((prev) => [...prev, data.skill].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: "", category: "", description: "" });
      toast.success(`Skill "${data.skill.name}" added.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Skill</CardTitle>
          <CardDescription>
            Skills are matched against user profiles to produce career predictions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="skill-name">Skill Name *</Label>
                <Input
                  id="skill-name"
                  placeholder="e.g. JavaScript"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="skill-category">Category</Label>
                <Input
                  id="skill-category"
                  placeholder="e.g. Programming Language"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="skill-description">Description</Label>
                <Input
                  id="skill-description"
                  placeholder="Optional description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Adding..." : "Add Skill"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          All Skills ({skills.length})
        </h3>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1"
              >
                <span className="text-sm font-medium">{skill.name}</span>
                {skill.category && (
                  <Badge variant="secondary" className="text-xs">
                    {skill.category}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internships Tab ──────────────────────────────────────────────────────────

function InternshipsTab({ initialInternships, careers }) {
  const [internships, setInternships] = useState(initialInternships);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    applyUrl: "",
    description: "",
    isRemote: false,
    careerId: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, careerId: form.careerId || undefined };
      const res = await fetch("/api/admin/internships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create internship");
      setInternships((prev) => [data.internship, ...prev]);
      setForm({ title: "", company: "", location: "", applyUrl: "", description: "", isRemote: false, careerId: "" });
      toast.success(`Internship "${data.internship.title}" added.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Internship Listing</CardTitle>
          <CardDescription>
            Link internships to a career path to surface them in recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="internship-title">Role Title *</Label>
                <Input
                  id="internship-title"
                  placeholder="e.g. Frontend Engineering Intern"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="internship-company">Company *</Label>
                <Input
                  id="internship-company"
                  placeholder="e.g. Acme Corp"
                  value={form.company}
                  onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="internship-location">Location</Label>
                <Input
                  id="internship-location"
                  placeholder="e.g. San Francisco, CA"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="internship-apply-url">Apply URL *</Label>
                <Input
                  id="internship-apply-url"
                  placeholder="https://..."
                  type="url"
                  value={form.applyUrl}
                  onChange={(e) => setForm((p) => ({ ...p, applyUrl: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="internship-description">Description</Label>
              <Input
                id="internship-description"
                placeholder="Brief internship description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="internship-career">Career Path (optional)</Label>
                <select
                  id="internship-career"
                  className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.careerId}
                  onChange={(e) => setForm((p) => ({ ...p, careerId: e.target.value }))}
                >
                  <option value="">— Generic (all career paths) —</option>
                  {careers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <input
                  id="internship-remote"
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={form.isRemote}
                  onChange={(e) => setForm((p) => ({ ...p, isRemote: e.target.checked }))}
                />
                <Label htmlFor="internship-remote">Remote position</Label>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Adding..." : "Add Internship"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Listings ({internships.length})
        </h3>
        {internships.length === 0 ? (
          <p className="text-sm text-muted-foreground">No internship listings yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {internships.map((item) => (
              <Card key={item.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.company}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {item.location && (
                      <Badge variant="outline" className="text-xs">{item.location}</Badge>
                    )}
                    {item.isRemote && (
                      <Badge variant="secondary" className="text-xs">Remote</Badge>
                    )}
                  </div>
                </div>
                {item.career && (
                  <p className="text-xs text-muted-foreground">
                    Path: {item.career.title}
                  </p>
                )}
                <a
                  href={item.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  View application →
                </a>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Panel ─────────────────────────────────────────────────────────

export default function AdminPanel({ initialCareers, initialSkills, initialInternships }) {
  return (
    <Tabs defaultValue="careers">
      <TabsList className="mb-6">
        <TabsTrigger value="careers">Careers</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="internships">Internships</TabsTrigger>
      </TabsList>

      <TabsContent value="careers">
        <CareersTab initialCareers={initialCareers} skills={initialSkills} />
      </TabsContent>

      <TabsContent value="skills">
        <SkillsTab initialSkills={initialSkills} />
      </TabsContent>

      <TabsContent value="internships">
        <InternshipsTab
          initialInternships={initialInternships}
          careers={initialCareers}
        />
      </TabsContent>
    </Tabs>
  );
}
