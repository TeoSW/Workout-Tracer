import type { DateStr } from './dates';

/** Column order from spec section 8. */
export const CSV_HEADER = [
  'date',
  'program',
  'day',
  'exercise',
  'set number',
  'kind',
  'kg',
  'added kg',
  'band level',
  'reps',
  'seconds',
  'attempts',
  'clean attempts',
  'clean',
  'RIR',
  'RPE',
  'note',
] as const;

export type CsvSetRow = {
  date: DateStr;
  program: string;
  day: string;
  exercise: string;
  setNumber: number;
  kind: 'warmup' | 'working';
  kg?: number | undefined;
  addedKg?: number | undefined;
  /** Only for sets that used bands. */
  bandLevel?: number | undefined;
  reps?: number | undefined;
  seconds?: number | undefined;
  attempts?: number | undefined;
  cleanAttempts?: number | undefined;
  clean?: boolean | undefined;
  rir: number | null;
  note?: string | undefined;
};

function field(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line endings. */
export function setRowsToCsv(rows: readonly CsvSetRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.program,
        r.day,
        r.exercise,
        r.setNumber,
        r.kind,
        r.kg,
        r.addedKg,
        r.bandLevel,
        r.reps,
        r.seconds,
        r.attempts,
        r.cleanAttempts,
        r.clean === undefined ? undefined : r.clean ? 'yes' : 'no',
        r.rir,
        r.rir === null ? undefined : 10 - r.rir,
        r.note,
      ]
        .map(field)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
