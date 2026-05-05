/**
 * Lee el git log en build time y devuelve commits agrupados por mes.
 *
 * Astro ejecuta esto en el frontmatter de la página /changelog durante
 * `astro build`, así que el resultado queda como HTML estático.
 *
 * Filtros:
 *   - Excluye merges, commits "wip", y subjects vacíos.
 *   - Ignora bots como dependabot, renovate.
 *   - Mantiene un cap razonable (default 60 commits).
 *
 * El subject se descompone en `type` (feat/fix/docs/refactor/...) cuando
 * sigue conventional commits, y `summary` (resto del mensaje sin el tipo).
 */

import { execSync } from 'node:child_process';

export interface ChangelogEntry {
  hash: string;
  shortHash: string;
  date: string; // ISO 8601
  type: string | null;
  scope: string | null;
  summary: string;
  raw: string;
}

export interface MonthGroup {
  yearMonth: string;     // '2026-05'
  label: string;         // 'mayo de 2026'
  entries: ChangelogEntry[];
}

const TYPE_RE = /^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/;

function parseSubject(raw: string): { type: string | null; scope: string | null; summary: string } {
  const m = raw.match(TYPE_RE);
  if (!m) return { type: null, scope: null, summary: raw };
  return { type: m[1].toLowerCase(), scope: m[2] ?? null, summary: m[3] };
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${MONTHS_ES[m - 1]} de ${y}`;
}

export function readChangelog(maxEntries = 60): MonthGroup[] {
  let out = '';
  try {
    out = execSync(
      `git log --no-merges --pretty=format:'%H%x09%aI%x09%s' -n ${maxEntries}`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );
  } catch {
    return [];
  }

  const entries: ChangelogEntry[] = out
    .split('\n')
    .map((line) => {
      const [hash, date, subject] = line.split('\t');
      if (!hash || !subject) return null;
      const { type, scope, summary } = parseSubject(subject);
      if (!summary || /^wip\b/i.test(summary)) return null;
      if (/dependabot|renovate|bot\b/i.test(subject)) return null;
      return {
        hash,
        shortHash: hash.slice(0, 7),
        date,
        type,
        scope,
        summary,
        raw: subject,
      } as ChangelogEntry;
    })
    .filter((e): e is ChangelogEntry => e !== null);

  // Agrupar por año-mes
  const groups = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (!groups.has(ym)) groups.set(ym, []);
    groups.get(ym)!.push(e);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([yearMonth, entries]) => ({
      yearMonth,
      label: monthLabel(yearMonth),
      entries,
    }));
}

const TYPE_LABELS: Record<string, string> = {
  feat: 'Nueva funcionalidad',
  fix: 'Corrección',
  docs: 'Documentación',
  refactor: 'Refactor',
  perf: 'Rendimiento',
  style: 'Estilo',
  test: 'Tests',
  chore: 'Mantenimiento',
  build: 'Build',
  ci: 'CI',
  content: 'Contenido',
};

export function typeLabel(type: string | null): string {
  if (!type) return 'Cambio';
  return TYPE_LABELS[type] || type;
}

const TYPE_COLOR: Record<string, string> = {
  feat: 'text-magenta',
  fix: 'text-forest',
  docs: 'text-ink/60',
  refactor: 'text-ink/70',
  perf: 'text-magenta',
  content: 'text-ink/70',
};

export function typeColor(type: string | null): string {
  if (!type) return 'text-ink/60';
  return TYPE_COLOR[type] || 'text-ink/60';
}
