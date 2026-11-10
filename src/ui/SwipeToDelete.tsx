import { IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/react';
import { useRef, type ReactNode } from 'react';
import { useConfirm } from './useConfirm';

/**
 * Wraps a list row so a swipe to the left shows Delete. Deleting asks first, because a swipe is
 * easy to make by accident.
 */
export function SwipeToDelete(props: {
  children: ReactNode;
  /** The question, e.g. "Delete this program?" */
  header: string;
  message?: string;
  label: string;
  onDelete: () => unknown;
}) {
  const confirm = useConfirm();
  const sliding = useRef<HTMLIonItemSlidingElement>(null);
  return (
    <IonItemSliding ref={sliding}>
      {props.children}
      <IonItemOptions side="end">
        <IonItemOption
          color="danger"
          aria-label={`Delete ${props.label}`}
          onClick={() => {
            void (async () => {
              await sliding.current?.close();
              const yes = await confirm({
                header: props.header,
                ...(props.message === undefined ? {} : { message: props.message }),
                confirm: 'Delete',
              });
              if (yes) await props.onDelete();
            })();
          }}
        >
          Delete
        </IonItemOption>
      </IonItemOptions>
    </IonItemSliding>
  );
}
