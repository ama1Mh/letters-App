import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('connections empty state', () => {
  it('shows the empty state with no pending requests', async () => {
    await renderShellIn('en', undefined, [], { pending: { incoming: [], outgoing: [] } });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/connections'));
    await waitFor(() => expect(screen.getByTestId('connections-empty')).toBeTruthy());
  });
});
