import type { z } from 'zod';

/** The first Zod issue as "path: message", for error text shown to the user. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'unknown problem';
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

export type Result<T, K extends string> =
  ({ ok: true } & { [key in K]: T }) | { ok: false; error: string };
