import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import type { LocalDraft } from '@/data/local/draftsStore';

import { renderShellIn } from './helpers/renderShell';

const DRAFTS: LocalDraft[] = [
  {
    id: 'draft-a',
    subject: 'Hello',
    body: 'Hi there',
    bodyDir: 'ltr',
    design: {},
    recipientId: null,
    dirty: false,
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'draft-b',
    subject: null,
    body: 'مرحبا',
    bodyDir: 'rtl',
    design: {},
    recipientId: null,
    dirty: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('drafts list', () => {
  it('shows existing drafts (untitled when there is no subject) and opens one for editing', async () => {
    await renderShellIn('en', undefined, DRAFTS);

    await fireEvent.press(screen.getAllByText('Drafts')[0]);
    await waitFor(() => expect(screen.getByTestId('draft-row-draft-a')).toBeTruthy());

    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('Hi there')).toBeTruthy();
    expect(screen.getByText('Untitled draft')).toBeTruthy();
    expect(screen.getByText('مرحبا')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('draft-row-draft-a'));
    await waitFor(() => expect(screen.getByTestId('compose-screen')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('compose-subject').props.value).toBe('Hello'));
    expect(screen.getByTestId('compose-body').props.value).toBe('Hi there');
  });
});
