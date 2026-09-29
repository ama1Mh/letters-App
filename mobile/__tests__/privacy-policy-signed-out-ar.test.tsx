import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { PRIVACY_POLICY } from '@/features/legal/privacyPolicy';

import { renderShellIn } from './helpers/renderShell';

describe('privacy policy from sign-up (ar/RTL, signed out, DEC-053)', () => {
  it('opens without an account and shows the Arabic text', async () => {
    await renderShellIn('ar', { session: null, profile: null });
    await fireEvent.press(await screen.findByTestId('sign-in-go-sign-up'));
    await fireEvent.press(await screen.findByTestId('sign-up-privacy-policy'));
    await waitFor(() => expect(screen.getByTestId('privacy-policy-screen')).toBeTruthy());

    expect(screen.getByText(PRIVACY_POLICY.content.ar.sections[0].heading)).toBeTruthy();
    expect(screen.getByText(/آخر تحديث: 29 سبتمبر 2026/)).toBeTruthy();
    expect(screen.queryByText(/\{\{/)).toBeNull();
  });
});
