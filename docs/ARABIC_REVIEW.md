# Arabic UI copy — review log

Arabic strings written by Claude are **provisional** (DEC-014). Only the owner changes a status to `approved`.
**Release gate: no `draft` rows before release.**

- Language: Modern Standard Arabic. Western digits (0–9). Gregorian calendar.
- Avoid gendered second-person phrasing where possible.
- Source of truth for the text is `mobile/src/core/i18n/locales/ar.json`. This table must list **every** key with the **same** Arabic text; `mobile/__tests__/arabic-review.test.ts` fails if it drifts.
- To approve a string: change `draft` to `approved` (and edit the Arabic first if you want a different wording — then update `ar.json` to match).

| Key | English | Arabic | Status | Notes |
|---|---|---|---|---|
| `app.name` | LetterApp | LetterApp | draft | Temporary name (DEC-001); Arabic may use a different localized name at the naming freeze |
| `tabs.inbox` | Inbox | الوارد | draft | |
| `tabs.drafts` | Drafts | المسودات | draft | |
| `tabs.sent` | Sent | المرسلة | draft | |
| `tabs.profile` | Profile | الملف الشخصي | draft | |
| `inbox.emptyTitle` | No letters yet | لا توجد رسائل بعد | draft | |
| `inbox.emptyBody` | Letters you receive will appear here. | ستظهر هنا الرسائل الواردة. | draft | |
| `drafts.emptyTitle` | No drafts | لا توجد مسودات | draft | |
| `drafts.emptyBody` | Letters you have not sent yet will appear here. | ستظهر هنا الرسائل التي لم تُرسل بعد. | draft | |
| `sent.emptyTitle` | No sent letters | لا توجد رسائل مرسلة | draft | |
| `sent.emptyBody` | Sent and scheduled letters will appear here. | ستظهر هنا الرسائل المرسلة والمجدولة. | draft | |
| `profile.language` | Language | اللغة | draft | |
| `language.title` | Language | اللغة | draft | |
| `language.system` | Device language | لغة الجهاز | draft | |
| `language.systemHint` | Follows your device settings | يتبع إعدادات الجهاز | draft | |
| `language.english` | English | English | draft | Language endonym: intentionally the same in both files |
| `language.arabic` | العربية | العربية | draft | Language endonym: intentionally the same in both files |
| `language.restartTitle` | Restart required | إعادة التشغيل مطلوبة | draft | |
| `language.restartMessage` | The app needs to restart to change the layout direction. | يلزم إعادة تشغيل التطبيق لتغيير اتجاه الواجهة. | draft | |
| `language.restartNow` | Restart now | إعادة التشغيل الآن | draft | |
| `language.restartLater` | Later | لاحقًا | draft | |
