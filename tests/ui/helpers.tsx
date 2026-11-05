import { fireEvent, render } from '@testing-library/react';
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
