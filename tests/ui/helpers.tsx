import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';
import { testContext } from '../unit/data/helpers';

/** Renders the whole app on a fresh database at a route. */
export function renderApp(route = '/tabs/today', ctx = testContext()) {
  window.location.hash = `#${route}`;
  render(<App ctx={ctx} />);
  return { ctx, user: userEvent.setup() };
}
