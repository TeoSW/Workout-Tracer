import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';
import { testContext } from '../unit/data/helpers';

/** Renders the whole app on a fresh database at a route. */
export function renderApp(route = '/tabs/today', ctx = testContext()) {
  window.location.hash = `#${route}`;
  render(<App ctx={ctx} />);
  return { ctx, user: userEvent.setup() };
}

/** Ionic inputs talk through custom events, which is what a real tap or keystroke ends in. */
export function ionEvent(element: Element, name: string, detail: Record<string, unknown>) {
  fireEvent(element, new CustomEvent(name, { detail, bubbles: true }));
}

/** ion-select keeps its label in its shadow DOM, so it is found by its label property. */
export function selectLabelled(label: string): Element {
  const found = [...document.querySelectorAll('ion-select')].find(
    (el) => (el as HTMLElement & { label?: string }).label === label,
  );
  if (!found) throw new Error(`No select labelled ${label}`);
  return found;
}

/** Taps a button on the Ionic alert that is showing. */
export async function confirmAlert(user: ReturnType<typeof userEvent.setup>, text: string) {
  await waitFor(() => {
    if (!document.querySelector('ion-alert button.alert-button')) throw new Error('No alert yet');
  });
  const buttons = [...document.querySelectorAll('ion-alert button.alert-button')];
  const button = buttons.find((b) => b.textContent?.trim() === text);
  if (!button) throw new Error(`No alert button ${text}`);
  await user.click(button);
}

/** ion-button moves its aria-label to the button inside its shadow DOM once hydrated. */
export async function buttonLabelled(label: string): Promise<Element> {
  return waitFor(() => {
    const found = [...document.querySelectorAll('ion-button')].find(
      (el) =>
        el.getAttribute('aria-label') === label ||
        el.shadowRoot?.querySelector('button')?.getAttribute('aria-label') === label,
    );
    if (!found) throw new Error(`No button labelled ${label}`);
    return found;
  });
}
