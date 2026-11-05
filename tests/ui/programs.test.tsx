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

describe('new program', () => {
  it('goes from split type to template to name', async () => {
    const { ctx, user } = renderApp('/tabs/programs/new');
    await screen.findByText('Template');
    ionEvent(selectLabelled('Split'), 'ionChange', { value: 'ppll' });
    const templates = within(screen.getByTestId('template-list'));
    expect(await templates.findByText('PPLL')).toBeInTheDocument();
    expect(templates.getByText('Blank')).toBeInTheDocument();
    await user.click(templates.getByText('PPLL'));
    ionEvent(screen.getByLabelText('Program name'), 'ionInput', { value: 'My split' });
    await user.click(screen.getByText('Create'));
    await waitFor(async () => {
      const programs = await listPrograms(ctx);
      expect(programs.map((p) => p.name)).toEqual(['My split']);
    });
    const [created] = await listPrograms(ctx);
    expect((await getProgram(ctx, created?.id ?? ''))?.dayTemplates).toHaveLength(3);
  });

  it('asks for a template first', async () => {
    const { user } = renderApp('/tabs/programs/new');
    await screen.findByText('Template');
    await user.click(screen.getByText('Create'));
    expect(await screen.findByText('Pick a template.')).toBeInTheDocument();
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
    renderApp(`/tabs/programs/${program.id}`, ctx);
    await screen.findByText('Schedule');
    const legs = (await getProgram(ctx, program.id))?.dayTemplates.find((d) => d.name === 'Legs');
    ionEvent(selectLabelled('Showing week'), 'ionChange', { value: 2 });
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
