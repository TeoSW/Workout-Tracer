import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { archiveBand } from '../../src/data/bands';
import { createProgramFromTemplate, deleteDayTemplate, getProgram } from '../../src/data/programs';
import { seedIfNeeded } from '../../src/data/seed';
import { PROGRAM_A, PROGRAM_C } from '../../src/domain/fixtures/templates';
import type { Block, DayTemplate } from '../../src/domain/schemas';
import { testContext } from '../unit/data/helpers';
import { buttonLabelled, confirmAlert, ionEvent, renderApp, selectLabelled } from './helpers';

async function setup(dayName: string) {
  const ctx = testContext();
  await seedIfNeeded(ctx);
  const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_C);
  const day = dayTemplates.find((d) => d.name === dayName) as DayTemplate;
  const dayUrl = `/tabs/programs/${program.id}/days/${day.id}`;
  const load = async () => {
    const loaded = await getProgram(ctx, program.id);
    return loaded?.dayTemplates.find((d) => d.id === day.id) as DayTemplate;
  };
  return { ctx, program, day, dayUrl, load };
}

function blockOf(day: DayTemplate, exerciseId: string): Block {
  const block = day.blocks.find((b) => b.kind === 'exercise' && b.exerciseId === exerciseId);
  if (!block) throw new Error(`No block ${exerciseId}`);
  return block;
}

const exerciseOrder = (day: DayTemplate) =>
  day.blocks.map((b) => (b.kind === 'exercise' ? b.exerciseId : 'choice'));

describe('day editor', () => {
  it('shows plan lines and edits the day fields', async () => {
    const { ctx, dayUrl, load } = await setup('Legs');
    renderApp(dayUrl, ctx);
    expect(await screen.findByText('Lumbar Extension')).toBeInTheDocument();
    expect(await screen.findByText('3 x 10 · 15kg')).toBeInTheDocument();

    ionEvent(screen.getByLabelText('Day name'), 'ionChange', { value: 'Lower' });
    ionEvent(selectLabelled('Day type'), 'ionChange', { value: 'strength' });
    ionEvent(screen.getByLabelText('Skip deloads'), 'ionChange', { checked: false });
    await waitFor(async () =>
      expect(await load()).toMatchObject({
        name: 'Lower',
        dayType: 'strength',
        deloadExempt: false,
      }),
    );
  });

  it('reorders blocks', async () => {
    const { ctx, dayUrl, load } = await setup('Legs');
    const { user } = renderApp(dayUrl, ctx);
    await user.click(await buttonLabelled('Move Squat up'));
    await waitFor(async () =>
      expect(exerciseOrder(await load()).slice(0, 3)).toEqual([
        'lumbar-extension',
        'squat',
        'bulgarian-split-squat',
      ]),
    );
  });

  it('adds an exercise from the library', async () => {
    const { ctx, dayUrl, load } = await setup('Legs');
    const { user } = renderApp(`${dayUrl}/add`, ctx);
    ionEvent(await screen.findByLabelText('Search exercises'), 'ionInput', { value: 'plank' });
    await user.click(await screen.findByText('Plank'));
    await waitFor(async () => expect(exerciseOrder(await load()).at(-1)).toBe('plank'));
  });

  it('deletes a day after confirming', async () => {
    const { ctx, program, day, dayUrl } = await setup('Dynamics');
    const { user } = renderApp(dayUrl, ctx);
    await user.click(await screen.findByText('Delete day'));
    await confirmAlert(user, 'Delete');
    await waitFor(async () => {
      const loaded = await getProgram(ctx, program.id);
      expect(loaded?.dayTemplates.map((d) => d.id)).not.toContain(day.id);
    });
  });
});

describe('block editor', () => {
  it('shows the fields of a weighted exercise and saves them', async () => {
    const { ctx, day, dayUrl, load } = await setup('Legs');
    const block = day.blocks[0] as Block;
    renderApp(`${dayUrl}/blocks/${block.id}`, ctx);
    ionEvent(await screen.findByLabelText('Reps min'), 'ionChange', { value: '12' });
    ionEvent(screen.getByLabelText('Load max'), 'ionChange', { value: '20' });
    await waitFor(async () =>
      expect((await load()).blocks[0]?.target).toMatchObject({
        repsMin: 12,
        loadMinKg: 15,
        loadMaxKg: 20,
      }),
    );
    expect(screen.queryByLabelText('Seconds min')).not.toBeInTheDocument();
  });

  it('clears a number field when it is emptied', async () => {
    const { ctx, day, dayUrl, load } = await setup('Legs');
    renderApp(`${dayUrl}/blocks/${day.blocks[0]?.id}`, ctx);
    ionEvent(await screen.findByLabelText('Load min'), 'ionChange', { value: '' });
    await waitFor(async () => expect((await load()).blocks[0]?.target.loadMinKg).toBeUndefined());
  });

  it('shows hold fields', async () => {
    const { ctx, day, dayUrl } = await setup('Light (front lever first)');
    renderApp(`${dayUrl}/blocks/${blockOf(day, 'front-lever-hold').id}`, ctx);
    expect(await screen.findByLabelText('Seconds min')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reps min')).not.toBeInTheDocument();
    expect(selectLabelled('Level')).toBeInTheDocument();
  });

  it('keeps added kg and bands apart', async () => {
    const { ctx, day, dayUrl, load } = await setup('Heavy (planche first)');
    const block = blockOf(day, 'weighted-dips');
    renderApp(`${dayUrl}/blocks/${block.id}`, ctx);
    await screen.findByLabelText('Added kg');
    ionEvent(await screen.findByLabelText('Band 15kg'), 'ionChange', { checked: true });
    await waitFor(async () =>
      expect(blockOf(await load(), 'weighted-dips').target).toMatchObject({ bandIds: ['band-15'] }),
    );
    expect(blockOf(await load(), 'weighted-dips').target.addedKg).toBeUndefined();
  });

  it('edits the parts of a complex', async () => {
    const { ctx, day, dayUrl, load } = await setup('Heavy (planche first)');
    const block = blockOf(day, 'planche-complex');
    const { user } = renderApp(`${dayUrl}/blocks/${block.id}`, ctx);
    ionEvent(await screen.findByLabelText('Part 2 target'), 'ionChange', { value: '4' });
    await waitFor(async () =>
      expect(blockOf(await load(), 'planche-complex').target.parts?.[1]).toMatchObject({
        name: 'Press',
        target: 4,
      }),
    );
    await user.click(screen.getByText('Add part'));
    await waitFor(async () =>
      expect(blockOf(await load(), 'planche-complex').target.parts).toHaveLength(4),
    );
  });

  it('sets the sets range, rest and superset, and removes the block', async () => {
    const { ctx, day, dayUrl, load } = await setup('Legs');
    const block = day.blocks[0] as Block;
    const { user } = renderApp(`${dayUrl}/blocks/${block.id}`, ctx);
    await user.click(await buttonLabelled('More sets at most'));
    await waitFor(async () => expect((await load()).blocks[0]?.setsMax).toBe(4));
    await user.click(await buttonLabelled('More rest seconds'));
    await waitFor(async () => expect((await load()).blocks[0]?.restSec).toBe(105));
    ionEvent(screen.getByLabelText('Superset with the next exercise'), 'ionChange', {
      checked: true,
    });
    await waitFor(async () => {
      const [a, b] = (await load()).blocks;
      expect(a?.supersetGroup).toBeDefined();
      expect(b?.supersetGroup).toBe(a?.supersetGroup);
    });
    await user.click(screen.getByText('Remove from day'));
    await waitFor(async () => expect((await load()).blocks).toHaveLength(9));
  });
});

describe('choice slots', () => {
  it('edits a shared slot on both Heavy days', async () => {
    const { ctx, program, day, dayUrl } = await setup('Heavy (planche first)');
    const block = day.blocks.find((b) => b.kind === 'choice') as Block;
    const { user } = renderApp(`${dayUrl}/blocks/${block.id}`, ctx);
    ionEvent(await screen.findByLabelText('Slot label'), 'ionChange', { value: 'Accessory' });
    await waitFor(async () => {
      const days = (await getProgram(ctx, program.id))?.dayTemplates ?? [];
      const labels = days.flatMap((d) =>
        d.blocks.flatMap((b) => (b.kind === 'choice' ? [b.choiceSlot.label] : [])),
      );
      expect(labels).toEqual(['Accessory', 'Accessory']);
    });
    const option = within(await screen.findByTestId('option-1'));
    ionEvent(option.getByLabelText('Pick when'), 'ionChange', { value: 'Always.' });
    ionEvent(selectLabelled('Add option'), 'ionChange', { value: 'plank' });
    await waitFor(async () => {
      const days = (await getProgram(ctx, program.id))?.dayTemplates ?? [];
      const heavy = days.find((d) => d.id !== day.id && d.name.startsWith('Heavy'));
      const slot = heavy?.blocks.find((b) => b.kind === 'choice');
      if (slot?.kind !== 'choice') throw new Error('missing slot');
      expect(slot.choiceSlot.options).toHaveLength(4);
      expect(slot.choiceSlot.options[1]?.pickWhen).toBe('Always.');
    });
    await user.click(await buttonLabelled('Remove option 4'));
    await waitFor(async () => {
      const days = (await getProgram(ctx, program.id))?.dayTemplates ?? [];
      const slot = days[0]?.blocks.find((b) => b.kind === 'choice');
      expect(slot?.kind === 'choice' && slot.choiceSlot.options).toHaveLength(3);
    });
  });

  it('adds a new choice slot from the library', async () => {
    const { ctx, dayUrl, load } = await setup('Legs');
    const { user } = renderApp(`${dayUrl}/add-choice`, ctx);
    await user.click(await screen.findByText('Plank'));
    await waitFor(async () => expect((await load()).blocks.at(-1)?.kind).toBe('choice'));
  });
});

describe('review fixes', () => {
  it('rounds reps to whole numbers and keeps decimals on kg', async () => {
    const { ctx, day, dayUrl, load } = await setup('Legs');
    renderApp(`${dayUrl}/blocks/${day.blocks[0]?.id}`, ctx);
    ionEvent(await screen.findByLabelText('Reps min'), 'ionChange', { value: '8.5' });
    ionEvent(screen.getByLabelText('Load min'), 'ionChange', { value: '12,5' });
    await waitFor(async () =>
      expect((await load()).blocks[0]?.target).toMatchObject({ repsMin: 9, loadMinKg: 12.5 }),
    );
  });

  it('keeps both ends of a range edited in a row', async () => {
    const { ctx, day, dayUrl, load } = await setup('Legs');
    renderApp(`${dayUrl}/blocks/${day.blocks[0]?.id}`, ctx);
    ionEvent(await screen.findByLabelText('Reps min'), 'ionChange', { value: '6' });
    ionEvent(screen.getByLabelText('Reps max'), 'ionChange', { value: '9' });
    await waitFor(async () =>
      expect((await load()).blocks[0]?.target).toMatchObject({ repsMin: 6, repsMax: 9 }),
    );
  });

  it('removes a choice option and keeps saved picks right', async () => {
    const { ctx, program, day, dayUrl } = await setup('Heavy (planche first)');
    const block = day.blocks.find((b) => b.kind === 'choice');
    if (block?.kind !== 'choice') throw new Error('missing choice');
    const slotId = block.choiceSlot.id;
    await ctx.db.programs.update(program.id, {
      choiceSelections: [{ cycleNumber: 1, slotId, optionIndex: 2 }],
    });
    const { user } = renderApp(`${dayUrl}/blocks/${block.id}`, ctx);
    await user.click(await buttonLabelled('Remove option 1'));
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.choiceSelections).toEqual([
        { cycleNumber: 1, slotId, optionIndex: 1 },
      ]),
    );
  });

  it('has no sets steppers on a choice block, and the add select resets', async () => {
    const { ctx, day, dayUrl } = await setup('Heavy (planche first)');
    const block = day.blocks.find((b) => b.kind === 'choice');
    renderApp(`${dayUrl}/blocks/${block?.id}`, ctx);
    await screen.findByLabelText('Slot label');
    expect(screen.queryByText('Up to')).not.toBeInTheDocument();
    ionEvent(selectLabelled('Add option'), 'ionChange', { value: 'plank' });
    await waitFor(() =>
      expect((selectLabelled('Add option') as HTMLElement & { value?: unknown }).value).toBeNull(),
    );
  });

  it('keeps an archived band listed while a target uses it', async () => {
    const { ctx, day, dayUrl } = await setup('Heavy (planche first)');
    await archiveBand(ctx, 'band-25');
    await archiveBand(ctx, 'band-35');
    renderApp(`${dayUrl}/blocks/${blockOf(day, 'planche-complex').id}`, ctx);
    expect(await screen.findByLabelText('Band 25kg')).toBeInTheDocument();
    expect(screen.queryByLabelText('Band 35kg')).not.toBeInTheDocument();
  });

  it('shows why the last day of a rotation cannot be deleted', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_A);
    for (const d of dayTemplates.slice(1)) await deleteDayTemplate(ctx, d.id);
    const { user } = renderApp(`/tabs/programs/${program.id}/days/${dayTemplates[0]?.id}`, ctx);
    await user.click(await screen.findByText('Delete day'));
    await confirmAlert(user, 'Delete');
    expect(await screen.findByText('A rotation needs at least one day.')).toBeInTheDocument();
  });
});
