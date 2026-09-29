import { pushText } from '../../supabase/functions/send-notifications/pushText';

const FSI = '⁨';
const LRI = '⁦';
const PDI = '⁩';

describe('Server-side push text (send-notifications)', () => {
  it('is localized from the recipient locale and names the sender with an isolated @username', () => {
    const sender = { sender_username: 'sam_1', sender_display_name: 'Sam' };
    expect(pushText({ recipient_locale: 'en', ...sender })).toEqual({
      title: 'New letter',
      body: `You have a new letter from ${FSI}Sam${PDI} (${LRI}@sam_1${PDI})`,
    });
    expect(pushText({ recipient_locale: 'ar', ...sender })).toEqual({
      title: 'رسالة جديدة',
      body: `لديك رسالة جديدة من ${FSI}Sam${PDI} (${LRI}@sam_1${PDI})`,
    });
  });

  it('falls back to the username without a display name, and to a neutral line without a sender', () => {
    expect(
      pushText({ recipient_locale: 'en', sender_username: 'sam_1', sender_display_name: null })
        .body,
    ).toBe(`You have a new letter from ${FSI}sam_1${PDI} (${LRI}@sam_1${PDI})`);
    expect(
      pushText({ recipient_locale: 'ar', sender_username: null, sender_display_name: null }),
    ).toEqual({ title: 'رسالة جديدة', body: 'لديك رسالة جديدة' });
  });
});
