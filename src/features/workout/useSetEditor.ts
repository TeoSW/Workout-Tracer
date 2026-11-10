import { useIonAlert } from '@ionic/react';
import { useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { getSettings } from '../../data/settings';
import { effortModeFor } from '../../domain/effort';
import {
  addSet,
  removeSet,
  setExerciseNote,
  toggleWarmup,
  updateSet,
  type SessionExerciseView,
} from '../../data/sessions';
import type { Exercise } from '../../domain/schemas';
import { draftFor, draftFromSet, draftToPatch, type SetDraft } from '../../domain/set-draft';
import type { CardActions } from './ExerciseCard';
import type { SheetSet } from './SetSheet';

type Guard = (action: () => Promise<unknown>) => Promise<void>;

/**
 * What the logger and the History editor share: the set sheet and the actions on set rows. Rest
 * and sound belong to a running workout, so the logger adds those through `afterSave`.
 */
export function useSetEditor(exercises: ReadonlyMap<string, Exercise> | undefined, guard: Guard) {
  const ctx = useData();
  const [presentAlert] = useIonAlert();
  const [openSet, setOpenSet] = useState<SheetSet | null>(null);
  const settings = useLive(getSettings);

  async function saveSet(open: SheetSet, draft: SetDraft, afterSave?: () => Promise<void>) {
    setOpenSet(null);
    await guard(async () => {
      await updateSet(ctx, open.set.id, draftToPatch(draft, open.exercise));
      await afterSave?.();
    });
  }

  function editNote(entry: SessionExerciseView) {
    void presentAlert({
      header: 'Note',
      inputs: [{ name: 'note', type: 'textarea', value: entry.note }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (values: { note: string }) =>
            void guard(() => setExerciseNote(ctx, entry.id, values.note)),
        },
      ],
    });
  }

  const setActions: Omit<CardActions, 'openInfo' | 'openMenu'> = {
    openSet: (entry, set, last) => {
      const exercise = exercises?.get(entry.exerciseId);
      if (!exercise) return;
      const draft = set.done
        ? draftFromSet(set, exercise)
        : draftFor({
            exercise,
            target: set.target ?? {},
            last,
            effortMode: effortModeFor(settings?.effortMode ?? 'rir', exercise),
          });
      setOpenSet({ set, exercise, draft, title: exercise.name });
    },
    toggleChecklist: (set, done) => void guard(() => updateSet(ctx, set.id, { done })),
    deleteSet: (set) => void guard(() => removeSet(ctx, set.id)),
    toggleWarmup: (set) => void guard(() => toggleWarmup(ctx, set.id)),
    addSet: (entry) => void guard(() => addSet(ctx, entry.id)),
  };

  return { openSet, closeSet: () => setOpenSet(null), saveSet, editNote, setActions };
}
