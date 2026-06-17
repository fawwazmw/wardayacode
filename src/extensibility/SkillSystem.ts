import type { Skill } from '../types.js';

export class SkillSystem {
  private skills = new Map<string, Skill>();

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  findByTrigger(input: string): Skill | undefined {
    const lower = input.toLowerCase();
    for (const skill of this.skills.values()) {
      if (skill.triggers?.some(t => lower.includes(t.toLowerCase()))) {
        return skill;
      }
    }
    return undefined;
  }
}
