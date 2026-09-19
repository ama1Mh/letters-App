import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('app shell (EN / LTR)', () => {
  it('opens on Inbox, shows all four tabs in English, and switches tabs', async () => {
    await renderShellIn('en');

    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
    expect(screen.getByText('No letters yet')).toBeTruthy();
    for (const label of ['Inbox', 'Drafts', 'Sent', 'Profile']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }

    await fireEvent.press(screen.getAllByText('Drafts')[0]);
    await waitFor(() => expect(screen.getByTestId('drafts-screen')).toBeTruthy());
    expect(screen.getByText('No drafts')).toBeTruthy();
  });
});
