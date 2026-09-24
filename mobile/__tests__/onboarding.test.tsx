import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { renderShellIn } from './helpers/renderShell';

describe('onboarding', () => {
  it('checks username availability, rejects a taken name, and completes onboarding', async () => {
    // The fake rejects the literal username "taken" (fakeAuthRepository.ts).
    await renderShellIn('en', { session: { userId: 'user-1' }, profile: null });
    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('onboarding-username'), 'taken');
    await waitFor(() => expect(screen.getByText('Not available')).toBeTruthy(), { timeout: 2000 });

    await fireEvent.changeText(screen.getByTestId('onboarding-username'), 'sara_writes');
    await waitFor(() => expect(screen.getByText('Available')).toBeTruthy(), { timeout: 2000 });

    await fireEvent.changeText(screen.getByTestId('onboarding-display-name'), 'Sara');
    await fireEvent.press(screen.getByTestId('onboarding-submit'));

    await waitFor(() => expect(screen.getByTestId('inbox-screen')).toBeTruthy());
  });
});
