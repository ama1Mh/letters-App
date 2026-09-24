import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { ConnectionRow } from '@/data/discovery/discoveryRepository';

import { renderShellIn } from './helpers/renderShell';

const INCOMING: ConnectionRow = {
  id: 'conn-in-1',
  otherUserId: 'user-in',
  otherUsername: 'incoming_user',
  otherDisplayName: 'Incoming User',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const OUTGOING: ConnectionRow = {
  id: 'conn-out-1',
  otherUserId: 'user-out',
  otherUsername: 'outgoing_user',
  otherDisplayName: 'Outgoing User',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('connections', () => {
  it('lists incoming and outgoing requests, with the right actions per section', async () => {
    await renderShellIn('en', undefined, [], {
      pending: { incoming: [INCOMING], outgoing: [OUTGOING] },
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/connections'));
    await waitFor(() => expect(screen.getByTestId('connections-screen')).toBeTruthy());

    expect(screen.getByText('Incoming User')).toBeTruthy();
    expect(screen.getByText('Outgoing User')).toBeTruthy();
    expect(screen.getByTestId('connections-accept-conn-in-1')).toBeTruthy();
    expect(screen.getByTestId('connections-decline-conn-in-1')).toBeTruthy();
    expect(screen.getByTestId('connections-cancel-conn-out-1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('connections-accept-conn-in-1'));
    // The fake repository's action succeeds without mutating its own fixture list, so re-fetching
    // after accept still returns both rows - this exercises the reload path, not fake-specific
    // list mutation.
    await waitFor(() => expect(screen.getByText('Incoming User')).toBeTruthy());
  });
});
