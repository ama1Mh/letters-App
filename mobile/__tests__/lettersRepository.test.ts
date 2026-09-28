import type { SupabaseClient } from '@supabase/supabase-js';

import {
  LetterActionError,
  createLettersRepository,
  parseLetterEvent,
  type LetterErrorCode,
} from '@/data/letters/lettersRepository';
import { defaultDesign } from '@/domain/design';

type RpcResult = { data?: unknown; error?: unknown };

function fakeClient(rpcResults: Record<string, RpcResult> = {}) {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: (name: string, args?: unknown) => {
      calls.push({ name, args });
      return Promise.resolve(rpcResults[name] ?? { data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const PERSON = {
  username: 'sara',
  display_name: 'Sara',
  avatar_key: null,
};

function inboxRow(id: string, sortAt: string) {
  return {
    id,
    thread_id: `thread-${id}`,
    subject: 'Hi',
    preview: 'Hello there',
    body_dir: 'ltr',
    delivered_at: sortAt,
    read_at: null,
    sort_at: sortAt,
    sender_id: 'u-sara',
    sender_username: PERSON.username,
    sender_display_name: PERSON.display_name,
    sender_avatar_key: PERSON.avatar_key,
  };
}

function sentRow(id: string, sortAt: string) {
  return {
    id,
    thread_id: `thread-${id}`,
    subject: null,
    preview: 'مرحبا',
    body_dir: 'rtl',
    status: 'scheduled',
    scheduled_at: sortAt,
    delivered_at: null,
    read_at: null,
    sort_at: sortAt,
    recipient_id: 'u-sara',
    recipient_username: PERSON.username,
    recipient_display_name: PERSON.display_name,
    recipient_avatar_key: PERSON.avatar_key,
  };
}

describe('createLettersRepository', () => {
  describe('sendLetter', () => {
    it('sends now with a null scheduled time and maps the send state', async () => {
      const { client, calls } = fakeClient({
        send_letter: {
          data: { status: 'delivered', scheduled_at: null, delivered_at: '2026-09-29T10:00:00Z' },
        },
      });
      const repo = createLettersRepository(client);

      await expect(repo.sendLetter('l1')).resolves.toEqual({
        status: 'delivered',
        scheduledAt: null,
        deliveredAt: '2026-09-29T10:00:00Z',
      });
      expect(calls).toEqual([
        { name: 'send_letter', args: { p_letter_id: 'l1', p_scheduled_at: null } },
      ]);
    });

    it('passes a scheduled time as an ISO (UTC) string', async () => {
      const { client, calls } = fakeClient({
        send_letter: {
          data: { status: 'scheduled', scheduled_at: '2026-09-29T12:00:00Z', delivered_at: null },
        },
      });
      const repo = createLettersRepository(client);

      await repo.sendLetter('l1', new Date('2026-09-29T12:00:00Z'));
      expect(calls[0].args).toEqual({
        p_letter_id: 'l1',
        p_scheduled_at: '2026-09-29T12:00:00.000Z',
      });
    });

    it.each<LetterErrorCode>([
      'recipient_required',
      'body_empty',
      'cannot_send',
      'schedule_in_past',
      'schedule_too_soon',
      'schedule_too_far',
      'rate_limited',
      'not_found',
      'not_authenticated',
    ])('maps the RPC error %s to a LetterActionError code', async (code) => {
      const { client } = fakeClient({ send_letter: { error: { message: code } } });
      await expect(createLettersRepository(client).sendLetter('l1')).rejects.toEqual(
        new LetterActionError(code),
      );
    });

    it('maps unknown and trigger-level errors to unknown', async () => {
      for (const message of ['delivered_immutable', 'invalid_status_transition', 'boom']) {
        const { client } = fakeClient({ send_letter: { error: { message } } });
        await expect(createLettersRepository(client).sendLetter('l1')).rejects.toEqual(
          new LetterActionError('unknown'),
        );
      }
      const { client } = fakeClient({ send_letter: { error: 'not an object' } });
      await expect(createLettersRepository(client).sendLetter('l1')).rejects.toEqual(
        new LetterActionError('unknown'),
      );
    });
  });

  it('unschedules a letter back to draft', async () => {
    const { client, calls } = fakeClient({
      unschedule_letter: { data: { status: 'draft', scheduled_at: null, delivered_at: null } },
    });
    await expect(createLettersRepository(client).unscheduleLetter('l1')).resolves.toEqual({
      status: 'draft',
      scheduledAt: null,
      deliveredAt: null,
    });
    expect(calls).toEqual([{ name: 'unschedule_letter', args: { p_letter_id: 'l1' } }]);
  });

  it.each<LetterErrorCode>(['already_delivered', 'not_scheduled', 'not_found'])(
    'maps the unschedule error %s',
    async (code) => {
      const { client } = fakeClient({ unschedule_letter: { error: { message: code } } });
      await expect(createLettersRepository(client).unscheduleLetter('l1')).rejects.toEqual(
        new LetterActionError(code),
      );
    },
  );

  it('marks a letter read and returns the stored read time', async () => {
    const { client, calls } = fakeClient({ mark_read: { data: '2026-09-29T10:05:00Z' } });
    await expect(createLettersRepository(client).markRead('l1')).resolves.toBe(
      '2026-09-29T10:05:00Z',
    );
    expect(calls).toEqual([{ name: 'mark_read', args: { p_letter_id: 'l1' } }]);
  });

  describe('listInbox', () => {
    it('maps rows and returns no cursor for a short page', async () => {
      const { client, calls } = fakeClient({
        list_inbox: { data: [inboxRow('a', '2026-09-29T10:00:00Z')] },
      });
      const page = await createLettersRepository(client).listInbox();

      expect(calls).toEqual([
        { name: 'list_inbox', args: { p_cursor_at: null, p_cursor_id: null, p_limit: 30 } },
      ]);
      expect(page).toEqual({
        items: [
          {
            id: 'a',
            threadId: 'thread-a',
            subject: 'Hi',
            preview: 'Hello there',
            bodyDir: 'ltr',
            deliveredAt: '2026-09-29T10:00:00Z',
            readAt: null,
            sortAt: '2026-09-29T10:00:00Z',
            sender: { id: 'u-sara', username: 'sara', displayName: 'Sara', avatarKey: null },
          },
        ],
        nextCursor: null,
      });
    });

    it("returns the last row's (sortAt, id) as the cursor for a full page, and sends it back", async () => {
      const rows = [inboxRow('b', '2026-09-29T11:00:00Z'), inboxRow('a', '2026-09-29T10:00:00Z')];
      const { client, calls } = fakeClient({ list_inbox: { data: rows } });
      const repo = createLettersRepository(client);

      const page = await repo.listInbox(null, 2);
      expect(page.nextCursor).toEqual({ at: '2026-09-29T10:00:00Z', id: 'a' });

      await repo.listInbox(page.nextCursor, 2);
      expect(calls[1].args).toEqual({
        p_cursor_at: '2026-09-29T10:00:00Z',
        p_cursor_id: 'a',
        p_limit: 2,
      });
    });

    it('clamps the page size to the server range', async () => {
      const { client, calls } = fakeClient({ list_inbox: { data: [] } });
      const repo = createLettersRepository(client);
      await repo.listInbox(null, 500);
      await repo.listInbox(null, 0);
      expect(calls.map((c) => (c.args as { p_limit: number }).p_limit)).toEqual([100, 1]);
    });

    it('treats a null result as an empty page', async () => {
      const { client } = fakeClient({ list_inbox: { data: null } });
      await expect(createLettersRepository(client).listInbox()).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });
  });

  describe('listSent', () => {
    it('passes the kind and maps rows including status and recipient', async () => {
      const { client, calls } = fakeClient({
        list_sent: { data: [sentRow('s1', '2026-09-30T08:00:00Z')] },
      });
      const page = await createLettersRepository(client).listSent('scheduled');

      expect(calls[0]).toEqual({
        name: 'list_sent',
        args: { p_kind: 'scheduled', p_cursor_at: null, p_cursor_id: null, p_limit: 30 },
      });
      expect(page.items[0]).toEqual({
        id: 's1',
        threadId: 'thread-s1',
        subject: null,
        preview: 'مرحبا',
        bodyDir: 'rtl',
        status: 'scheduled',
        scheduledAt: '2026-09-30T08:00:00Z',
        deliveredAt: null,
        readAt: null,
        sortAt: '2026-09-30T08:00:00Z',
        recipient: { id: 'u-sara', username: 'sara', displayName: 'Sara', avatarKey: null },
      });
      expect(page.nextCursor).toBeNull();
    });

    it('maps invalid_input (a bad kind) to its code', async () => {
      const { client } = fakeClient({ list_sent: { error: { message: 'invalid_input' } } });
      await expect(createLettersRepository(client).listSent('sent')).rejects.toEqual(
        new LetterActionError('invalid_input'),
      );
    });
  });

  describe('getLetter', () => {
    const letterRow = {
      id: 'l1',
      thread_id: 't1',
      parent_letter_id: null,
      subject: 'Hello',
      body: 'Full body',
      body_dir: 'ltr',
      design: {
        v: 1,
        paper: 'sky',
        font: 'caveat',
        ink: 'navy',
        layout: 'standard',
        stamp: null,
        stickers: [],
      },
      status: 'delivered',
      scheduled_at: null,
      delivered_at: '2026-09-29T10:00:00Z',
      read_at: null,
      viewer_role: 'recipient',
      sender_id: 'u-sara',
      sender_username: 'sara',
      sender_display_name: 'Sara',
      sender_avatar_key: null,
      recipient_id: 'u-me',
      recipient_username: 'me_user',
      recipient_display_name: 'Me',
      recipient_avatar_key: null,
    };

    it('maps the single row, including the design and both people', async () => {
      const { client, calls } = fakeClient({ get_letter: { data: [letterRow] } });
      const letter = await createLettersRepository(client).getLetter('l1');

      expect(calls).toEqual([{ name: 'get_letter', args: { p_letter_id: 'l1' } }]);
      expect(letter).toMatchObject({
        id: 'l1',
        threadId: 't1',
        parentLetterId: null,
        body: 'Full body',
        bodyDir: 'ltr',
        status: 'delivered',
        viewerRole: 'recipient',
        sender: { id: 'u-sara', username: 'sara', displayName: 'Sara', avatarKey: null },
        recipient: { id: 'u-me', username: 'me_user', displayName: 'Me', avatarKey: null },
      });
      expect(letter.design).toMatchObject({ paper: 'sky', ink: 'navy' });
    });

    it('falls back to the default design for an invalid stored design', async () => {
      const { client } = fakeClient({
        get_letter: { data: [{ ...letterRow, design: { paper: 'not-a-paper' } }] },
      });
      const letter = await createLettersRepository(client).getLetter('l1');
      expect(letter.design).toEqual(defaultDesign());
    });

    it('rejects with not_found for an RPC not_found and for an empty result', async () => {
      const notFound = new LetterActionError('not_found');
      const raised = fakeClient({ get_letter: { error: { message: 'not_found' } } });
      await expect(createLettersRepository(raised.client).getLetter('x')).rejects.toEqual(notFound);
      const empty = fakeClient({ get_letter: { data: [] } });
      await expect(createLettersRepository(empty.client).getLetter('x')).rejects.toEqual(notFound);
    });
  });
});

describe('parseLetterEvent', () => {
  it('parses each event type, with status and Realtime message id when present', () => {
    expect(
      parseLetterEvent({
        type: 'broadcast',
        event: 'letter_status',
        payload: { letter_id: 'l1', status: 'undeliverable', id: 'm1' },
      }),
    ).toEqual({ type: 'letter_status', letterId: 'l1', status: 'undeliverable', messageId: 'm1' });
    for (const event of ['letter_delivered', 'letter_read', 'letter_deleted_for_me']) {
      expect(parseLetterEvent({ event, payload: { letter_id: 'l2' } })).toEqual({
        type: event,
        letterId: 'l2',
        status: null,
        messageId: null,
      });
    }
  });

  it('ignores anything malformed or unknown instead of trusting it', () => {
    for (const message of [
      null,
      'letter_read',
      { event: 'something_else', payload: { letter_id: 'l1' } },
      { event: 'letter_read' },
      { event: 'letter_read', payload: null },
      { event: 'letter_read', payload: { letter_id: 42 } },
      { event: 'letter_read', payload: {} },
    ]) {
      expect(parseLetterEvent(message)).toBeNull();
    }
    // An unknown status is dropped, not passed through.
    expect(
      parseLetterEvent({ event: 'letter_status', payload: { letter_id: 'l1', status: 'hacked' } })
        ?.status,
    ).toBeNull();
  });
});

describe('subscribeToLetterEvents', () => {
  function channelClient() {
    let broadcastHandler: ((message: unknown) => void) | null = null;
    let statusHandler: ((status: string) => void) | null = null;
    interface FakeChannel {
      on: jest.Mock<FakeChannel, [string, unknown, (message: unknown) => void]>;
      subscribe: jest.Mock<FakeChannel, [(status: string) => void]>;
    }
    const channel: FakeChannel = {
      on: jest.fn((_type: string, _filter: unknown, handler: (message: unknown) => void) => {
        broadcastHandler = handler;
        return channel;
      }),
      subscribe: jest.fn((handler: (status: string) => void) => {
        statusHandler = handler;
        return channel;
      }),
    };
    const client = {
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(async () => 'ok'),
    } as unknown as SupabaseClient;
    return {
      client,
      channel,
      broadcast: (message: unknown) => broadcastHandler?.(message),
      status: (value: string) => statusHandler?.(value),
    };
  }

  it('joins the private letters:<user id> topic, forwards parsed events and reports (re)subscribes', () => {
    const fake = channelClient();
    const onEvent = jest.fn();
    const onSubscribed = jest.fn();
    const unsubscribe = createLettersRepository(fake.client).subscribeToLetterEvents('me', {
      onEvent,
      onSubscribed,
    });

    expect(fake.client.channel).toHaveBeenCalledWith('letters:me', { config: { private: true } });
    expect(fake.channel.on).toHaveBeenCalledWith('broadcast', { event: '*' }, expect.any(Function));

    fake.broadcast({ event: 'letter_delivered', payload: { letter_id: 'l1', id: 'm1' } });
    fake.broadcast({ event: 'nonsense', payload: { letter_id: 'l1' } });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'letter_delivered',
      letterId: 'l1',
      status: null,
      messageId: 'm1',
    });

    fake.status('SUBSCRIBED');
    fake.status('CHANNEL_ERROR');
    fake.status('SUBSCRIBED'); // rejoined after a reconnect
    expect(onSubscribed).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(fake.client.removeChannel).toHaveBeenCalledWith(fake.channel);
  });
});
