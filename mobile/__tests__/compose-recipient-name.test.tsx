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

describe('compose: the recipient row names the person', () => {
  it('keeps the generic label when the profile is not visible (everyone mode, no connection)', async () => {
    const draft = draftTo('user-stranger');
    await renderShellIn('en', undefined, [draft]);
    await openDraft(draft);
    await waitFor(() => expect(screen.getByText('Recipient selected')).toBeTruthy());
    expect(screen.queryByTestId('compose-recipient-name')).toBeNull();
  });
});
