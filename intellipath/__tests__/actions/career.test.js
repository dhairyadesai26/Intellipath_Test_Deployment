import { 
  getCurrentUserWithSkills, 
  predictCareers, 
  getSkillGap, 
  generateLearningStepsForSkill, 
  getAIGenerationStatus 
} from '@/actions/career';
import { db } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

jest.mock('@/lib/prisma', () => ({
  db: {
    user: { findUnique: jest.fn() },
    prediction: { findMany: jest.fn(), count: jest.fn() },
    career: { findUnique: jest.fn() },
    roadmap: { upsert: jest.fn(), findFirst: jest.fn() },
    internship: { findMany: jest.fn() },
  }
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('Academic Review: action/career.js (White Box Statement/Branch Coverage)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // Function: getCurrentUserWithSkills
  // ──────────────────────────────────────────────────────────────
  describe('getCurrentUserWithSkills()', () => {
    it('Path 1: throws Unauthorized if no userId', async () => {
      auth.mockResolvedValue({ userId: null });
      await expect(getCurrentUserWithSkills()).rejects.toThrow('Unauthorized');
    });

    it('Path 2: throws User not found if db returns null', async () => {
      auth.mockResolvedValue({ userId: 'user_123' });
      db.user.findUnique.mockResolvedValue(null);
      await expect(getCurrentUserWithSkills()).rejects.toThrow('User not found');
    });

    it('Path 3: returns user if found', async () => {
      const mockUser = { id: 1, skills: ['js'], industry: 'Tech' };
      auth.mockResolvedValue({ userId: 'user_123' });
      db.user.findUnique.mockResolvedValue(mockUser);
      
      const res = await getCurrentUserWithSkills();
      expect(res).toEqual(mockUser);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Function: predictCareers
  // ──────────────────────────────────────────────────────────────
  describe('predictCareers()', () => {
    it('Path 1: returns empty context if no user skills exist internally or externally', async () => {
      auth.mockResolvedValue({ userId: 'user_123' });
      db.user.findUnique.mockResolvedValue({ id: 1, skills: [] });
      
      const res = await predictCareers([]);
      expect(res.careers).toEqual([]);
      expect(res.userSkills).toEqual([]);
    });

    it('Path 2: returns empty array if no predictions exist in DB', async () => {
      auth.mockResolvedValue({ userId: 'user_123' });
      db.user.findUnique.mockResolvedValue({ id: 1, skills: ['React'] });
      db.prediction.findMany.mockResolvedValue([]);
      
      const res = await predictCareers();
      expect(res.careers).toEqual([]);
    });

    it('Path 3: maps raw DB predictions into structured analytical data', async () => {
      auth.mockResolvedValue({ userId: 'user_123' });
      db.user.findUnique.mockResolvedValue({ id: 1, skills: ['react'] });
      
      const mockPrediction = [{
        matchScore: 90,
        career: {
          id: 10, title: 'Dev', slug: 'dev', description: 'desc', industry: 'tech', level: 'Mid',
          careerSkills: [ { skill: { name: 'React' } }, { skill: { name: 'Node' } } ]
        }
      }];
      db.prediction.findMany.mockResolvedValue(mockPrediction);

      const res = await predictCareers();
      expect(res.careers.length).toBe(1);
      expect(res.careers[0].matchedSkills).toEqual(['react']);
      expect(res.careers[0].requiredSkills).toContain('react');
      expect(res.careers[0].requiredSkills).toContain('node');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Function: getSkillGap
  // ──────────────────────────────────────────────────────────────
  describe('getSkillGap()', () => {
    it('Branch 1: fallbacks to top prediction if no careerId is directly specified', async () => {
      auth.mockResolvedValue({ userId: '1' });
      db.user.findUnique.mockResolvedValue({ id: 1, skills: ['html'] }); 
      
      const mockPrediction = [{
        matchScore: 90,
        career: {
          id: 10, title: 'Dev', slug: 'dev', description: 'desc', industry: 'tech', level: 'Mid',
          careerSkills: [ { skill: { name: 'html' } }, { skill: { name: 'css' } } ]
        }
      }];
      db.prediction.findMany.mockResolvedValue(mockPrediction); 
      db.career.findUnique.mockResolvedValue(mockPrediction[0].career);

      const res = await getSkillGap();
      expect(res.career.title).toBe('Dev');
      expect(res.matchedSkills).toEqual(['html']);
      expect(res.missingSkills).toEqual(['css']);
    });
    
    it('Branch 2: strictly throws error if explicitly passed careerId is invalid', async () => {
      auth.mockResolvedValue({ userId: '1' });
      db.user.findUnique.mockResolvedValue({ id: 1, skills: ['html'] });
      db.career.findUnique.mockResolvedValue(null);
      
      await expect(getSkillGap(55)).rejects.toThrow('Career not found');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Function: generateLearningStepsForSkill
  // ──────────────────────────────────────────────────────────────
  describe('generateLearningStepsForSkill()', () => {
    it('Line Coverage: accurately generates exactly 3 scaled array steps', async () => {
      const res = await generateLearningStepsForSkill('TypeScript');
      expect(res.length).toBe(3);
      expect(res[0].title).toContain('TypeScript');
      expect(res[0].order).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Function: getAIGenerationStatus
  // ──────────────────────────────────────────────────────────────
  describe('getAIGenerationStatus()', () => {
    it('Condition Coverage: tests all early return boolean paths', async () => {
      // Step A: No Auth
      auth.mockResolvedValue({ userId: null });
      expect(await getAIGenerationStatus()).toEqual({ profileReady: false, dataReady: false });

      // Step B: Authenticated but No User in DB
      auth.mockResolvedValue({ userId: '1' });
      db.user.findUnique.mockResolvedValue(null);
      expect(await getAIGenerationStatus()).toEqual({ profileReady: false, dataReady: false });

      // Step C: User exists but profile incomplete
      db.user.findUnique.mockResolvedValue({ id: 1, industry: null });
      expect(await getAIGenerationStatus()).toEqual({ profileReady: false, dataReady: false });

      // Step D: Profile fully complete and AI ran
      db.user.findUnique.mockResolvedValue({ id: 1, industry: 'Tech', skills: ['A'] });
      db.prediction.count.mockResolvedValue(5);
      expect(await getAIGenerationStatus()).toEqual({ profileReady: true, dataReady: true });
    });
  });
});
