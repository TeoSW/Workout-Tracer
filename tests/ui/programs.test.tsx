import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  activateProgram,
  createProgramFromTemplate,
  getActiveProgram,
  getProgram,
  listPrograms,
} from '../../src/data/programs';
import { seedIfNeeded } from '../../src/data/seed';
import { PROGRAM_A, PROGRAM_B, PROGRAM_C } from '../../src/domain/fixtures/templates';
import { testContext } from '../unit/data/helpers';
import { buttonLabelled, confirmAlert, ionEvent, renderApp, selectLabelled } from './helpers';

async function withProgram(template = PROGRAM_C) {
  const ctx = testContext();
  await seedIfNeeded(ctx);
  const { program } = await createProgramFromTemplate(ctx, template);
  return { ctx, program };
}

describe('program list', () => {
  it('shows the active program first and links to the rest of the tab', async () => {
    const { ctx, program } = await withProgram();
    await createProgramFromTemplate(ctx, PROGRAM_A);
    await activateProgram(ctx, program.id, 'this_week');
    renderApp('/tabs/programs', ctx);
    expect(await screen.findByText('Calisthenics 6-week cycle')).toBeInTheDocument();
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('ULU/LUL')).toBeInTheDocument();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
    expect(screen.getByText('Import program')).toBeInTheDocument();
  });

  it('explains itself when empty', async () => {
    renderApp('/tabs/programs');
    expect(await screen.findByText('No programs yet.')).toBeInTheDocument();
  });
});

describe('swipe to delete', () => {
  it('deletes a program from the list after asking', async () => {
    const { ctx, program } = await withProgram();
    const { user } = renderApp('/tabs/programs', ctx);
    await screen.findByText(program.name);
    await user.click(screen.getByLabelText(`Delete ${program.name}`));
    await confirmAlert(user, 'Delete');
    await waitFor(async () => expect(await listPrograms(ctx)).toEqual([]));
  });

  it('removes an exercise from the library, keeping it for past workouts', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { user } = renderApp('/tabs/programs/library', ctx);
    await screen.findByText('Plank');
    await user.click(screen.getByLabelText('Delete Plank'));
    await confirmAlert(user, 'Delete');
    await waitFor(() => expect(screen.queryByText('Plank')).not.toBeInTheDocument());
    expect((await ctx.db.exercises.get('plank'))?.archived).toBe(true);
  });
});

describe('new program', () => {
  it('lists the presets, with the Excel cycle first and a one-line summary', async () => {
    renderApp('/tabs/programs/new');
    const presets = within(await screen.findByTestId('preset-list'));
    const names = presets.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names[0]).toBe('Calisthenics 5-week cycle');
    expect(names).toContain('Beginner calisthenics');
    expect(names).toContain('PPLL');
    expect(presets.getByText('5-week cycle, 4 days a week, deload in week 5')).toBeInTheDocument();
  });

  it('previews a preset, then uses it from the week you are in', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { user } = renderApp('/tabs/programs/presets/tpl-cal5', ctx);
    expect(await screen.findByText('Weeks 1-2')).toBeInTheDocument();
    expect(screen.getByText('Weeks 3-4')).toBeInTheDocument();
    expect(screen.getAllByText('Heavy 1, planche (intensity)').length).toBeGreaterThan(0);
    await user.click(await buttonLabelled('More weeks'));
    await user.click(await buttonLabelled('More weeks'));
    await user.click(screen.getByText('Use this program'));
    await waitFor(async () =>
      expect(await getActiveProgram(ctx)).toMatchObject({
        name: 'Calisthenics 5-week cycle',
        anchorDate: '2026-10-19',
      }),
    );
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today'));
    expect(await screen.findByText('Week 3 of 5')).toBeInTheDocument();
  });

  it('can copy a preset to edit it first, without starting it', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { user } = renderApp('/tabs/programs/presets/tpl-b', ctx);
    await user.click(await screen.findByText('Edit before using'));
    await waitFor(async () =>
      expect((await listPrograms(ctx)).map((p) => p.name)).toEqual(['PPLL']),
    );
    expect(await getActiveProgram(ctx)).toBeUndefined();
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/tabs\/programs\/id-/));
  });

  it('creates a blank program, and asks for its name first', async () => {
    const { ctx, user } = renderApp('/tabs/programs/new');
    await user.click(await screen.findByText('Create blank program'));
    expect(await screen.findByText('Give the program a name.')).toBeInTheDocument();
    ionEvent(selectLabelled('Split'), 'ionChange', { value: 'ppll' });
    ionEvent(screen.getByLabelText('Program name'), 'ionInput', { value: 'My split' });
    await user.click(screen.getByText('Create blank program'));
    await waitFor(async () =>
      expect((await listPrograms(ctx)).map((p) => [p.name, p.splitType])).toEqual([
        ['My split', 'ppll'],
      ]),
    );
  });
});

describe('program editor', () => {
  it('activates a program from this Monday or next', async () => {
    const { ctx, program } = await withProgram();
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    await user.click(await screen.findByText('Start next week'));
    await waitFor(async () =>
      expect(await getActiveProgram(ctx)).toMatchObject({
        id: program.id,
        anchorDate: '2026-11-09',
      }),
    );
  });

  it('shows the week, and sets the current week and a deload', async () => {
    const { ctx, program } = await withProgram();
    await activateProgram(ctx, program.id, 'this_week');
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    expect(await screen.findByText('Week 1 of 6')).toBeInTheDocument();
    await user.click(await buttonLabelled('More current week'));
    expect(await screen.findByText('Week 2 of 6')).toBeInTheDocument();
    ionEvent(screen.getByLabelText('Deload this week'), 'ionChange', { checked: true });
    await waitFor(async () =>
      expect((await getActiveProgram(ctx))?.manualDeloadWeeks).toEqual(['2026-11-02']),
    );
  });

  it('has a Save button that confirms and goes back', async () => {
    const { ctx, program } = await withProgram();
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    ionEvent(await screen.findByLabelText('Program note'), 'ionChange', {
      value: 'Planche first.',
    });
    await user.click(screen.getByText('Save'));
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/programs'));
    expect((await getProgram(ctx, program.id))?.program.note).toBe('Planche first.');
  });

  it('renames and saves the note', async () => {
    const { ctx, program } = await withProgram();
    renderApp(`/tabs/programs/${program.id}`, ctx);
    ionEvent(await screen.findByLabelText('Program name'), 'ionChange', { value: 'Calisthenics' });
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.name).toBe('Calisthenics'),
    );
  });

  it('shrinks the cycle and drops deload weeks past the end', async () => {
    const { ctx, program } = await withProgram();
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    await screen.findByText('Schedule');
    await user.click(await buttonLabelled('Fewer cycle weeks'));
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program).toMatchObject({
        cycleWeeks: 5,
        deloadWeeks: [],
      }),
    );
  });

  it('changes a day in the weekday grid for the chosen week', async () => {
    const { ctx, program } = await withProgram();
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    await screen.findByText('Schedule');
    const legs = (await getProgram(ctx, program.id))?.dayTemplates.find((d) => d.name === 'Legs');
    await user.click(screen.getByText('Week 2'));
    await waitFor(() => selectLabelled('Tuesday'));
    ionEvent(selectLabelled('Tuesday'), 'ionChange', { value: legs?.id });
    await waitFor(async () => {
      const schedule = (await getProgram(ctx, program.id))?.program.schedule;
      if (schedule?.kind !== 'weekday') throw new Error('expected weekday grid');
      expect(schedule.weeks[1]?.tue).toBe(legs?.id);
      expect(schedule.weeks[0]?.tue).toBeNull();
    });
  });

  it('reorders a rotation and sets sessions per week', async () => {
    const { ctx, program } = await withProgram(PROGRAM_A);
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    await user.click(await buttonLabelled('Move Upper A down'));
    await waitFor(async () => {
      const loaded = await getProgram(ctx, program.id);
      if (loaded?.program.schedule.kind !== 'rotation') throw new Error('expected rotation');
      const names = new Map(loaded.dayTemplates.map((d) => [d.id, d.name]));
      expect(loaded.program.schedule.sequence.map((id) => names.get(id))).toEqual([
        'Lower A',
        'Upper A',
        'Upper B',
        'Lower B',
      ]);
    });
    await user.click(await buttonLabelled('More sessions'));
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.schedule).toMatchObject({
        sessionsPerWeek: 4,
      }),
    );
  });

  it('adds a day', async () => {
    const { ctx, program } = await withProgram(PROGRAM_B);
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    ionEvent(await screen.findByLabelText('New day name'), 'ionInput', { value: 'Arms' });
    await user.click(screen.getByText('Add day'));
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.dayTemplates.map((d) => d.name)).toContain(
        'Arms',
      ),
    );
  });

  it('deletes a program after confirming', async () => {
    const { ctx, program } = await withProgram();
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    await user.click(await screen.findByText('Delete program'));
    await confirmAlert(user, 'Delete');
    await waitFor(async () => expect(await getProgram(ctx, program.id)).toBeUndefined());
  });
});

describe('switching the schedule type', () => {
  it('asks first, and cancelling leaves the schedule alone', async () => {
    const { ctx, program } = await withProgram();
    const { user } = renderApp(`/tabs/programs/${program.id}`, ctx);
    await screen.findByText('Schedule');
    ionEvent(screen.getByLabelText('Schedule type'), 'ionChange', { value: 'rotation' });
    await confirmAlert(user, 'Cancel');
    await waitFor(() => expect(document.querySelector('ion-alert')).toBeNull());
    expect((await getProgram(ctx, program.id))?.program.schedule.kind).toBe('weekday');

    ionEvent(screen.getByLabelText('Schedule type'), 'ionChange', { value: 'rotation' });
    await confirmAlert(user, 'Switch');
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.schedule.kind).toBe('rotation'),
    );
  });
});
