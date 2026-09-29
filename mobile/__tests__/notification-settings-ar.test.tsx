import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import ar from '../src/core/i18n/locales/ar.json';

import { renderShellIn } from './helpers/renderShell';

describe('notification settings (ar/RTL, DEC-052)', () => {
  it('renders in Arabic and opens the phone settings', async () => {
    await renderShellIn('ar');
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => router.push('/settings/notifications'));
    await waitFor(() => expect(screen.getByTestId('notifications-screen')).toBeTruthy());
    expect(screen.getByText(ar.notifications.pushOnDeliveryLabel)).toBeTruthy();
    expect(screen.getByText(ar.notifications.pushOnDeliveryHint)).toBeTruthy();

    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await fireEvent.press(screen.getByTestId('notifications-open-system-settings'));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
