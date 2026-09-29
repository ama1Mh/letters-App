import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { renderShellIn } from './helpers/renderShell';

describe('notification settings, save fails (DEC-052)', () => {
  it('reverts the switch', async () => {
    const view = await renderShellIn('en');
    jest
      .spyOn(view.backend.repository, 'updatePushOnDelivery')
      .mockRejectedValueOnce(new Error('offline'));
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/settings/notifications'));
    await waitFor(() => expect(screen.getByTestId('notifications-screen')).toBeTruthy());

    fireEvent(screen.getByTestId('notifications-push-on-delivery'), 'valueChange', false);
    await waitFor(() =>
      expect(screen.getByTestId('notifications-push-on-delivery').props.value).toBe(true),
    );
  });
});
