import { BandSchema, type Band } from '../domain/schemas';
import { clean } from './clean';
import type { DataContext } from './context';

export async function listBands(
  ctx: DataContext,
  opts: { includeArchived?: boolean } = {},
): Promise<Band[]> {
  const bands = await ctx.db.bands.toArray();
  return bands
    .filter((b) => opts.includeArchived || !b.archived)
    .sort((a, b) => a.ratedKg - b.ratedKg || a.label.localeCompare(b.label));
}

export async function loadBandMap(ctx: DataContext): Promise<Map<string, Band>> {
  return new Map((await ctx.db.bands.toArray()).map((b) => [b.id, b]));
}

export async function addBand(
  ctx: DataContext,
  input: { label: string; ratedKg: number; color?: string },
): Promise<Band> {
  const band = BandSchema.parse(clean({ ...input, id: ctx.newId() }));
  await ctx.db.bands.add(band);
  return band;
}

export async function updateBand(
  ctx: DataContext,
  id: string,
  patch: Partial<Omit<Band, 'id'>>,
): Promise<Band> {
  return ctx.db.transaction('rw', ctx.db.bands, async () => {
    const current = await ctx.db.bands.get(id);
    if (!current) throw new Error(`No band ${id}`);
    const band = BandSchema.parse(clean({ ...current, ...patch, id }));
    await ctx.db.bands.put(band);
    return band;
  });
}

/** Bands are archived, never deleted, because past sets and plan targets point at them. */
export async function archiveBand(ctx: DataContext, id: string): Promise<Band> {
  return updateBand(ctx, id, { archived: true });
}
