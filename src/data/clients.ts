import { ClientSchema, type Client, type Program } from '../domain/schemas';
import { clean } from './clean';
import type { DataContext } from './context';

export type ClientInput = { name: string; note: string };

/** Active clients by name. Archived ones stay for their programs but leave the list. */
export async function listClients(ctx: DataContext): Promise<Client[]> {
  const all = await ctx.db.clients.toArray();
  return all.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClient(
  ctx: DataContext,
  id: string,
): Promise<{ client: Client; programs: Program[] } | undefined> {
  const client = await ctx.db.clients.get(id);
  if (!client) return undefined;
  const programs = (await ctx.db.programs.toArray())
    .filter((p) => p.clientId === id)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { client, programs };
}

export async function addClient(ctx: DataContext, input: ClientInput): Promise<Client> {
  const name = input.name.trim();
  if (name === '') throw new Error('Give the client a name.');
  const client = ClientSchema.parse(
    clean({
      id: ctx.newId(),
      name,
      note: input.note.trim(),
      createdAt: ctx.clock.now(),
      archived: false,
    }),
  );
  await ctx.db.clients.add(client);
  return client;
}

export async function updateClient(
  ctx: DataContext,
  id: string,
  patch: Partial<ClientInput>,
): Promise<Client> {
  return ctx.db.transaction('rw', ctx.db.clients, async () => {
    const current = await ctx.db.clients.get(id);
    if (!current) throw new Error(`No client ${id}`);
    const name = patch.name === undefined ? current.name : patch.name.trim();
    if (name === '') throw new Error('Give the client a name.');
    const updated = ClientSchema.parse(
      clean({ ...current, name, note: patch.note === undefined ? current.note : patch.note }),
    );
    await ctx.db.clients.put(updated);
    return updated;
  });
}

/** Hides a client from the list. Their programs stay, so nothing sent is lost. */
export async function archiveClient(ctx: DataContext, id: string): Promise<void> {
  const updated = await ctx.db.clients.update(id, { archived: true });
  if (updated === 0) throw new Error(`No client ${id}`);
}
