import { act, screen, waitFor } from 'expo-router/testing-library';

// Only test helpers and locale JSON are imported here (see realtime-inbox.test.tsx).

import en from '../src/core/i18n/locales/en.json';
import { renderShellIn } from './helpers/renderShell';

describe('offline banner (en)', () => {
  afterEach(() => globalThis.__setNetInfo({ isConnected: true }));

  it('shows while offline, hides when back online and refreshes the inbox', async () => {
    const view = await renderShellIn('en');
    const listInbox = jest.spyOn(view.letters, 'listInbox');
    await waitFor(() => expect(screen.getByTestId('inbox-empty')).toBeTruthy());
    expect(screen.queryByTestId('offline-banner')).toBeNull();

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => globalThis.__setNetInfo({ isConnected: false }));
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText(en.network.offline)).toBeTruthy();
    const loads = listInbox.mock.calls.length;

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => globalThis.__setNetInfo({ isConnected: true }));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    await waitFor(() => expect(listInbox.mock.calls.length).toBeGreaterThan(loads));
  });
});
