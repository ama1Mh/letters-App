import { act, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import type { LocalDraft } from '@/data/local/draftsStore';
import { defaultDesign } from '@/domain/design';

import { renderShellIn } from './helpers/renderShell';

function draftTo(recipientId: string): LocalDraft {
  return {
    id: `draft-to-${recipientId}`,
    subject: null,
    body: 'Hello',
    bodyDir: 'ltr',
    design: defaultDesign(),
    recipientId,
    dirty: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function openDraft(draft: LocalDraft) {
  await act(async () => router.push(`/compose/${draft.id}`));
  await waitFor(() => expect(screen.getByTestId('compose-recipient-row')).toBeTruthy());
}

describe('compose: the recipient row names the person (ar/RTL)', () => {
  it('looks up a connection it has no remembered card for (a draft from another device), in Arabic', async () => {
    const draft = draftTo('user-friend');
    await renderShellIn('ar', undefined, [draft], {
      profileCards: [
        { id: 'user-friend', username: 'layla_haddad', displayName: 'ليلى', avatarKey: 'flower' },
      ],
    });
    await openDraft(draft);
    await waitFor(() =>
      expect(screen.getByTestId('compose-recipient-name')).toHaveTextContent(/ليلى/),
    );
    // @username is isolated left-to-right inside the RTL row.
    expect(screen.getByTestId('compose-recipient-name')).toHaveTextContent(/⁦@layla_haddad⁩/);
  });
});
