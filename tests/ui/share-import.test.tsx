import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgramFromTemplate, getProgram, listPrograms } from '../../src/data/programs';
import { seedIfNeeded } from '../../src/data/seed';
import { shareProgram } from '../../src/data/share';
import { PROGRAM_A } from '../../src/domain/fixtures/templates';
import { testContext } from '../unit/data/helpers';
import { ionEvent, renderApp } from './helpers';

vi.mock('../../src/pwa/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/pwa/files')>()),
  saveFile: vi.fn(async () => 'saved'),
}));

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

async function sender() {
  const ctx = testContext({ idPrefix: 's' });
  await seedIfNeeded(ctx);
  const { program } = await createProgramFromTemplate(ctx, PROGRAM_A);
  return { ctx, program };
}

describe('share program', () => {
  it('shows the code, copies it and saves a file', async () => {
    const { saveFile } = await import('../../src/pwa/files');
    const { ctx, program } = await sender();
    const { code } = await shareProgram(ctx, program.id);

    const { user } = renderApp(`/tabs/programs/${program.id}/share`, ctx);
    // After render, because userEvent.setup() installs its own clipboard.
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await screen.findByText(code)).toBeInTheDocument();
    await user.click(screen.getByText('Copy code'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(code));
    expect(await screen.findByText('Code copied.')).toBeInTheDocument();

    await user.click(screen.getByText('Share as file'));
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(vi.mocked(saveFile).mock.calls[0]?.[0]).toBe('ULU-LUL.workout-program.json');
  });

  it('still shows the code when copying is not available', async () => {
    const { ctx, program } = await sender();
    const { user } = renderApp(`/tabs/programs/${program.id}/share`, ctx);
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await user.click(await screen.findByText('Copy code'));
    expect(await screen.findByText('Select the code and copy it.')).toBeInTheDocument();
  });
});

describe('import program', () => {
  it('previews a code, then adds it as a new program', async () => {
    const source = await sender();
    const { code } = await shareProgram(source.ctx, source.program.id);
    cleanup();

    const { ctx, user } = renderApp('/tabs/programs/import');
    ionEvent(await screen.findByLabelText('Share code'), 'ionInput', { value: code });
    await user.click(screen.getByText('Preview'));
    expect(await screen.findByText('ULU/LUL')).toBeInTheDocument();
    expect(screen.getByText('4 days')).toBeInTheDocument();
    expect(await listPrograms(ctx)).toEqual([]);

    await user.click(screen.getByText('Add program'));
    await waitFor(async () => expect(await listPrograms(ctx)).toHaveLength(1));
    const [added] = await listPrograms(ctx);
    expect((await getProgram(ctx, added?.id ?? ''))?.dayTemplates).toHaveLength(4);
  });

  it('reads a program file', async () => {
    const source = await sender();
    const { share } = await shareProgram(source.ctx, source.program.id);
    const { user } = renderApp('/tabs/programs/import');
    await screen.findByLabelText('Share code');
    const file = new File([JSON.stringify(share)], 'p.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Program file'), file);
    expect(await screen.findByText('ULU/LUL')).toBeInTheDocument();
  });

  it('shows the error for a bad code and adds nothing', async () => {
    const { ctx, user } = renderApp('/tabs/programs/import');
    ionEvent(await screen.findByLabelText('Share code'), 'ionInput', { value: 'WT1.nope' });
    await user.click(screen.getByText('Preview'));
    expect(await screen.findByText('This share code is damaged.')).toBeInTheDocument();
    expect(screen.queryByText('Add program')).not.toBeInTheDocument();
    expect(await listPrograms(ctx)).toEqual([]);
  });
});
