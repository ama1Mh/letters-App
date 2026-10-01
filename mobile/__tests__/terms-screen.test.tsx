import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import en from '../src/core/i18n/locales/en.json';
import { fillLegalText } from '@/features/legal/document';
import { TERMS } from '@/features/legal/terms';

import { renderShellIn } from './helpers/renderShell';

describe('terms of service screen (en, DEC-054)', () => {
  it('opens from Profile with every section, placeholders filled', async () => {
    await renderShellIn('en');
    await fireEvent.press((await screen.findAllByText(en.tabs.profile))[0]);
    await fireEvent.press(await screen.findByTestId('profile-terms-row'));
    await waitFor(() => expect(screen.getByTestId('terms-screen')).toBeTruthy());

    for (const section of TERMS.content.en.sections) {
      expect(
        screen.getByText(fillLegalText(section.heading, { appName: en.app.name })),
      ).toBeTruthy();
    }
    expect(screen.queryByText(/\{\{/)).toBeNull();
    expect(screen.getByTestId('terms-screen-draft-notice')).toBeTruthy();
    expect(screen.getByText(en.legal.draftNotice)).toBeTruthy();
    expect(screen.getByText(/laws of the Kingdom of Saudi Arabia/)).toBeTruthy();
    expect(screen.getByText(/operated by .*Amal Faqihi/)).toBeTruthy();
  });
});
