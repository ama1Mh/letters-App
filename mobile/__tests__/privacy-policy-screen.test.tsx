import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import en from '../src/core/i18n/locales/en.json';
import { PRIVACY_POLICY } from '@/features/legal/privacyPolicy';

import { renderShellIn } from './helpers/renderShell';

describe('privacy policy screen (en, DEC-053)', () => {
  it('opens from Profile with every section and the contact address filled in', async () => {
    await renderShellIn('en');
    await fireEvent.press((await screen.findAllByText(en.tabs.profile))[0]);
    await fireEvent.press(await screen.findByTestId('profile-privacy-policy-row'));
    await waitFor(() => expect(screen.getByTestId('privacy-policy-screen')).toBeTruthy());

    for (const section of PRIVACY_POLICY.en.sections) {
      expect(screen.getByText(section.heading)).toBeTruthy();
    }
    expect(screen.getByText(/Last updated: September 29, 2026/)).toBeTruthy();
    expect(screen.getAllByText(/privacy@letterapp\.invalid/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\{\{/)).toBeNull();
  });
});
