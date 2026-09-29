import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import en from '../src/core/i18n/locales/en.json';

import { renderShellIn } from './helpers/renderShell';

describe('notification settings (DEC-052)', () => {
  it('opens from Profile and turns push on delivery off and on, saving each change', async () => {
    const view = await renderShellIn('en');
    await fireEvent.press((await screen.findAllByText(en.tabs.profile))[0]);
    await fireEvent.press(await screen.findByTestId('profile-notifications-row'));
    await waitFor(() => expect(screen.getByTestId('notifications-screen')).toBeTruthy());
    expect(screen.getByText(en.notifications.pushOnDeliveryLabel)).toBeTruthy();

    // Default fixture (fakeProfile()) has push on.
    const toggle = () => screen.getByTestId('notifications-push-on-delivery');
    expect(toggle().props.value).toBe(true);
    const saved = async () =>
      (await view.backend.repository.getOwnProfile('user-shell'))?.pushOnDelivery;

    fireEvent(toggle(), 'valueChange', false);
    await waitFor(() => expect(toggle().props.value).toBe(false));
    await waitFor(async () => expect(await saved()).toBe(false));

    fireEvent(toggle(), 'valueChange', true);
    await waitFor(async () => expect(await saved()).toBe(true));
  });
});
