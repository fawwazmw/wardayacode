import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Skill } from '../types.js';

/** Max characters of a single skill injected into the system prompt. */
const MAX_SKILL_CHARS = 4_000;
/** Max total characters of all skills injected into the system prompt. */
const MAX_TOTAL_CHARS = 12_000;

export interface LoadedSkill extends Skill {
  /** Absolute path to the skill's source file. */
  source: string;
}

/**
 * Directories scanned for skills, in precedence order (project first, so a
 * project skill overrides a user skill with the same name).
 */
export function getSkillDirs(projectRoot: string): string[] {
  return [
    path.join(projectRoot, '.wardayacode', 'skills'),
    path.join(os.homedir(), '.config', 'wardayacode', 'skills'),
  ];
}

function firstNonEmptyLine(content: string): string | undefined {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !/^triggers?:/i.test(trimmed)) return trimmed;
  }
  return undefined;
}

/**
 * Load `*.md` skills from the project and user skill directories.
 * The filename (without extension) is the skill name.
 */
export async function loadSkills(projectRoot: string): Promise<LoadedSkill[]> {
  const skills: LoadedSkill[] = [];
  const seen = new Set<string>();

  for (const dir of getSkillDirs(projectRoot)) {
    let files: string[];
    try {
      files = (await fs.readdir(dir)).filter(f => f.endsWith('.md'));
    } catch {
      continue;
    }

    for (const file of files) {
      const name = file.replace(/\.md$/, '');
      if (seen.has(name)) continue;
      seen.add(name);

      const source = path.join(dir, file);
      let raw: string;
      try {
        raw = await fs.readFile(source, 'utf-8');
      } catch {
        continue;
      }

      const heading = raw.match(/^#\s+(.+)$/m);
      const description = (heading?.[1] ?? firstNonEmptyLine(raw) ?? name).trim();
      const triggerMatch = raw.match(/^triggers?:\s*(.+)$/im);
      const triggers = triggerMatch
        ? triggerMatch[1]!.split(',').map(t => t.trim()).filter(Boolean)
        : undefined;

      skills.push({
        name,
        description,
        content: raw.slice(0, MAX_SKILL_CHARS),
        source,
        ...(triggers ? { triggers } : {}),
      });
    }
  }

  return skills;
}

/**
 * Format loaded skills into a system-prompt section. Returns an empty string
 * when there are no skills. Total size is capped so a large skills directory
 * cannot blow up the context window.
 */
export function formatSkillsForPrompt(skills: Array<Skill & { source?: string }>): string {
  if (skills.length === 0) return '';

  const parts: string[] = [];
  let used = 0;

  for (const skill of skills) {
    const block = `## ${skill.name}\n${skill.description}\n\n${skill.content}`;
    if (used + block.length > MAX_TOTAL_CHARS) {
      const hint = skill.source ? ` — read ${skill.source} for details` : '';
      parts.push(`## ${skill.name}\n${skill.description}\n\n(skill content omitted${hint})`);
      break;
    }
    used += block.length;
    parts.push(block);
  }

  return `\n\n--- Available Skills ---\nThe user has defined the following skills. Apply them when relevant.\n\n${parts.join('\n\n')}`;
}
