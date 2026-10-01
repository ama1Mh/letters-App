import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import ar from '../src/core/i18n/locales/ar.json';
import { renderShellIn } from './helpers/renderShell';

describe('privacy settings, save fails (ar)', () => {
  it('puts the previous value back and shows a translated error', async () => {
    const view = await renderShellIn('ar');
    jest
      .spyOn(view.backend.repository, 'updateReceiveSettings')
      .mockRejectedValueOnce(new Error('offline'));
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/settings/privacy'));
    await waitFor(() => expect(screen.getByTestId('privacy-screen')).toBeTruthy());
    const before = screen.getByTestId('privacy-discoverable-by-email').props.value as boolean;

    fireEvent(screen.getByTestId('privacy-discoverable-by-email'), 'valueChange', !before);
    await waitFor(() => expect(screen.getByTestId('privacy-save-error')).toBeTruthy());
    expect(screen.getByTestId('privacy-discoverable-by-email').props.value).toBe(before);
    expect(screen.getByText(ar.privacy.saveError)).toBeTruthy();
  });
});
