import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addClient, listClients } from '../../src/data/clients';
import { createProgramFromTemplate, getProgram, listPrograms } from '../../src/data/programs';
import { seedIfNeeded } from '../../src/data/seed';
import { PROGRAM_B } from '../../src/domain/fixtures/templates';
import { getStoredProfile } from '../../src/pwa/profile';
import { reloadApp } from '../../src/pwa/reload';
import { testContext } from '../unit/data/helpers';
import { confirmAlert, ionEvent, renderApp } from './helpers';

vi.mock('../../src/pwa/reload', () => ({ reloadApp: vi.fn() }));

async function coach() {
  const ctx = testContext({ profile: 'coach' });
  await seedIfNeeded(ctx);
  return ctx;
}

afterEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(navigator, 'share');
  vi.mocked(reloadApp).mockClear();
});

describe('profile switch', () => {
  it('switches to the coach profile after asking, and reloads', async () => {
    const { user } = renderApp('/tabs/settings');
    expect(getStoredProfile()).toBe('me');
    const segment = await screen.findByLabelText('Profile');
    ionEvent(segment, 'ionChange', { value: 'coach' });
    await confirmAlert(user, 'Switch');
    expect(getStoredProfile()).toBe('coach');
    expect(reloadApp).toHaveBeenCalledOnce();
  });

  it('puts the switch back when the switch is cancelled', async () => {
    const { user } = renderApp('/tabs/settings');
    const segment = await screen.findByLabelText('Profile');
    ionEvent(segment, 'ionChange', { value: 'coach' });
    await confirmAlert(user, 'Cancel');
    await waitFor(() => {
      const fresh = screen.getByLabelText('Profile') as HTMLElement & { value?: string };
      expect(fresh).not.toBe(segment);
      expect(fresh.value).toBe('me');
    });
    expect(getStoredProfile()).toBe('me');
    expect(reloadApp).not.toHaveBeenCalled();
  });

  it('keeps only the settings the coach uses', async () => {
    renderApp('/tabs/settings', await coach());
    expect(await screen.findByText('Bands')).toBeInTheDocument();
    expect(screen.queryByLabelText('Sound')).not.toBeInTheDocument();
    expect(screen.queryByText('Backup reminder')).not.toBeInTheDocument();
  });

  it('shows Clients, Programs and Settings in the coach profile, opening on Clients', async () => {
    renderApp('/', await coach());
    expect(
      await screen.findByText('Add a client, then build and send their program.'),
    ).toBeTruthy();
    const tabs = [...document.querySelectorAll('ion-tab-button')].map((t) => t.textContent);
    expect(tabs).toEqual(['Clients', 'Programs', 'Settings']);
  });
});

describe('clients', () => {
  it('adds a client with a note', async () => {
    const ctx = await coach();
    const { user } = renderApp('/tabs/clients', ctx);
    await user.click(await screen.findByLabelText('Add client'));
    ionEvent(await screen.findByLabelText('Client name'), 'ionInput', { value: 'Ana' });
    ionEvent(screen.getByLabelText('Client note'), 'ionInput', { value: 'No dips' });
    await user.click(screen.getByText('Add'));
    await waitFor(async () =>
      expect(await listClients(ctx)).toMatchObject([{ name: 'Ana', note: 'No dips' }]),
    );
    expect(await screen.findByRole('heading', { name: 'Ana', level: 2 })).toBeTruthy();
  });

  it('builds a program for a client from a preset, without starting it', async () => {
    const ctx = await coach();
    const ana = await addClient(ctx, { name: 'Ana', note: '' });
    const { user } = renderApp(`/tabs/clients/${ana.id}`, ctx);
    await user.click(await screen.findByText('New program for Ana'));
    await user.click(await screen.findByText('Calisthenics 5-week cycle'));
    expect(screen.queryByText('Use this program')).not.toBeInTheDocument();
    await user.click(await screen.findByText('Create for Ana'));
    await waitFor(async () => {
      const [program] = await listPrograms(ctx);
      expect(program).toMatchObject({ clientId: ana.id, active: false });
    });
    expect(await screen.findByText('Send to Ana')).toBeInTheDocument();
  });
});

describe('sending a program', () => {
  it('shares a message with the code, then shows it as sent, and as changed after an edit', async () => {
    const ctx = await coach();
    const ana = await addClient(ctx, { name: 'Ana', note: '' });
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_B, undefined, {
      clientId: ana.id,
    });
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    const { user } = renderApp(`/tabs/programs/${program.id}/send`, ctx);
    expect(await screen.findByText(/Hi Ana, here is your program "PPLL"/)).toBeInTheDocument();
    await user.click(screen.getByText('Send message'));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const [{ text }] = share.mock.calls[0] as unknown as [{ text: string }];
    expect(text).toMatch(/paste this code:\n\nWT1\./);
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.sentAt).toBe(ctx.clock.now()),
    );
    expect(await screen.findByText('Sent to Ana.')).toBeInTheDocument();
  });

  it('does not count a copied message as sent until the coach says so', async () => {
    const ctx = await coach();
    const ana = await addClient(ctx, { name: 'Ana', note: '' });
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_B, undefined, {
      clientId: ana.id,
    });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { user } = renderApp(`/tabs/programs/${program.id}/send`, ctx);
    await user.click(await screen.findByText('Send message'));
    expect(await screen.findByText(/Message copied/)).toBeInTheDocument();
    expect((await getProgram(ctx, program.id))?.program.sentAt).toBeUndefined();
    await user.click(screen.getByText('Mark as sent'));
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.sentAt).toBe(ctx.clock.now()),
    );
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('stays on the client page when Save meets a name that was cleared', async () => {
    const ctx = await coach();
    const ana = await addClient(ctx, { name: 'Ana', note: '' });
    const { user } = renderApp(`/tabs/clients/${ana.id}`, ctx);
    ionEvent(await screen.findByLabelText('Client name'), 'ionChange', { value: '' });
    await user.click(screen.getByText('Save'));
    expect(await screen.findByText('Give the client a name.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 300));
    expect(window.location.hash).toBe(`#/tabs/clients/${ana.id}`);
  });

  it('lists the sent state on the client page', async () => {
    const ctx = await coach();
    const ana = await addClient(ctx, { name: 'Ana', note: '' });
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_B, undefined, {
      clientId: ana.id,
    });
    renderApp(`/tabs/clients/${ana.id}`, ctx);
    const list = within(await screen.findByTestId('client-programs'));
    expect(await list.findByText('Not sent yet')).toBeInTheDocument();
    expect(list.getByText(program.name)).toBeInTheDocument();
  });
});
