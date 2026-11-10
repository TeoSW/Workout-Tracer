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
