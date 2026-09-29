import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import type { LocalDraft } from '@/data/local/draftsStore';

import en from '../src/core/i18n/locales/en.json';
import { mockAlerts } from './helpers/alerts';
import { renderShellIn } from './helpers/renderShell';

const DRAFT: LocalDraft = {
  id: 'my-draft',
  subject: null,
  body: 'unsent',
  bodyDir: 'ltr',
  design: {},
  recipientId: null,
  dirty: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Deleting the account (Phase 9)', () => {
  it('asks twice, deletes the account, clears local drafts and returns to sign-in', async () => {
    const alerts = mockAlerts('cancel');
    const view = await renderShellIn('en', undefined, [DRAFT]);
    const deleteAccount = jest.spyOn(view.backend.repository, 'deleteAccount');

    await fireEvent.press(screen.getAllByText('Profile')[0]);
    await waitFor(() => expect(screen.getByTestId('profile-delete-account-row')).toBeTruthy());

    // Cancel at the first question: nothing happens.
    await fireEvent.press(screen.getByTestId('profile-delete-account-row'));
    expect(alerts.shown[0].title).toBe(en.profile.deleteAccountTitle);
    expect(deleteAccount).not.toHaveBeenCalled();

    // Confirm both questions.
    alerts.choose('confirm');
    await fireEvent.press(screen.getByTestId('profile-delete-account-row'));
    await waitFor(() => expect(screen.getByTestId('sign-in-screen')).toBeTruthy());
    expect(alerts.shown.map((a) => a.title)).toEqual([
      en.profile.deleteAccountTitle,
      en.profile.deleteAccountTitle,
      en.profile.deleteAccountFinalTitle,
    ]);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(await view.drafts.list()).toEqual([]);
  });
});
