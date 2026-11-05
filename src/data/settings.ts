import { AppSettingsSchema, DEFAULT_SETTINGS, type AppSettings } from '../domain/schemas';
import { clean } from './clean';
import type { DataContext } from './context';

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

/** Stored settings over the defaults. A stored value that no longer validates falls back. */
export async function getSettings(ctx: DataContext): Promise<AppSettings> {
  const rows = await ctx.db.settings.bulkGet(KEYS);
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  rows.forEach((row, i) => {
    const key = KEYS[i];
    if (!row || key === undefined) return;
    const parsed = AppSettingsSchema.shape[key].safeParse(row.value);
    if (parsed.success) settings[key] = parsed.data;
  });
  return settings as AppSettings;
}

export async function setSetting<K extends keyof AppSettings>(
  ctx: DataContext,
  key: K,
  value: AppSettings[K],
): Promise<void> {
  const parsed = AppSettingsSchema.shape[key].parse(value);
  await ctx.db.settings.put(clean({ key, value: parsed }));
}
