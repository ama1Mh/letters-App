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
| `inbox.unread` | Unread | غير مقروءة | draft | Phase 6 M5: accessibility hint on an unread inbox row |
| `drafts.emptyTitle` | No drafts | لا توجد مسودات | draft | |
| `drafts.emptyBody` | Letters you have not sent yet will appear here. | ستظهر هنا الرسائل التي لم تُرسل بعد. | draft | |
| `drafts.newButton` | New draft | مسودة جديدة | draft | |
| `drafts.untitled` | Untitled draft | مسودة بلا عنوان | draft | |
| `compose.title` | Draft | المسودة | draft | |
| `compose.subjectLabel` | Subject | الموضوع | draft | |
| `compose.bodyLabel` | Write your letter… | اكتب رسالتك… | draft | |
| `compose.saving` | Saving… | جارٍ الحفظ… | draft | |
| `compose.delete` | Delete draft | حذف المسودة | draft | |
| `compose.deleteConfirmTitle` | Delete this draft? | هل تريد حذف هذه المسودة؟ | draft | |
| `compose.deleteConfirmMessage` | This cannot be undone. | لا يمكن التراجع عن هذا الإجراء. | draft | |
| `compose.deleteConfirmCancel` | Cancel | إلغاء | draft | |
| `compose.deleteConfirmConfirm` | Delete | حذف | draft | |
| `compose.changeDesign` | Change design | تغيير التصميم | draft | |
| `design.paperLabel` | Paper | الورق | draft | |
| `design.fontLabel` | Font | الخط | draft | |
| `design.inkLabel` | Ink | الحبر | draft | |
| `design.stampLabel` | Stamp | الطابع | draft | |
| `design.noStamp` | No stamp | بلا طابع | draft | |
| `design.paperNames.cream` | Cream | كريمي | draft | |
| `design.paperNames.blush` | Blush | وردي فاتح | draft | |
| `design.paperNames.sky` | Sky | سماوي | draft | |
| `design.paperNames.mint` | Mint | نعناعي | draft | |
| `design.paperNames.sand` | Sand | رملي | draft | |
| `design.paperNames.lavender` | Lavender | خزامي | draft | |
| `design.fontNames.caveat` | Caveat | Caveat | draft | Font name, a proper noun: intentionally the same in both files (like the language endonyms) |
| `design.fontNames.playfair_display` | Playfair Display | Playfair Display | draft | Font name, not translated |
| `design.fontNames.cairo` | Cairo | Cairo | draft | Font name, not translated |
| `design.fontNames.tajawal` | Tajawal | Tajawal | draft | Font name, not translated |
| `design.fontNames.amiri` | Amiri | Amiri | draft | Font name, not translated |
| `design.inkNames.classic_black` | Classic black | أسود كلاسيكي | draft | |
| `design.inkNames.navy` | Navy | كحلي | draft | |
| `design.inkNames.forest` | Forest | أخضر غابي | draft | |
| `design.inkNames.burgundy` | Burgundy | عنّابي | draft | |
| `design.inkNames.charcoal` | Charcoal | رمادي فحمي | draft | |
| `design.inkNames.royal_purple` | Royal purple | بنفسجي ملكي | draft | |
| `design.inkNames.warm_brown` | Warm brown | بني دافئ | draft | |
| `design.inkNames.teal` | Teal | أزرق مخضر | draft | |
| `design.stampNames.heart` | Heart | قلب | draft | |
| `design.stampNames.star` | Star | نجمة | draft | |
| `design.stampNames.ribbon` | Ribbon | شريط | draft | |
| `design.stampNames.rocket` | Rocket | صاروخ | draft | |
| `sent.emptyTitle` | No sent letters | لا توجد رسائل مرسلة | draft | |
| `sent.emptyBody` | Letters you send will appear here. | ستظهر هنا الرسائل المرسلة. | draft | Reworded in Phase 6 M4: the Sent kind only (Scheduled has its own empty state) |
| `sent.tabScheduled` | Scheduled | المجدولة | draft | Phase 6 M4 Sent tab |
| `sent.tabSent` | Sent | المرسلة | draft | Phase 6 M4 Sent tab |
| `sent.scheduledEmptyTitle` | Nothing scheduled | لا توجد رسائل مجدولة | draft | Phase 6 M4 Sent tab |
| `sent.scheduledEmptyBody` | Letters you schedule wait here until they're delivered. | تنتظر هنا الرسائل المجدولة حتى يتم تسليمها. | draft | Phase 6 M4 Sent tab |
| `sent.to` | To | إلى | draft | Phase 6 M4 Sent tab |
| `sent.scheduledFor` | Delivers {{when}} | موعد التسليم: {{when}} | draft | Phase 6 M4 Sent tab; `{{when}}` is a date and time with Western digits |
| `sent.deliveredAt` | Delivered {{when}} | تم التسليم: {{when}} | draft | Phase 6 M4 Sent tab; `{{when}}` is a date and time with Western digits |
| `sent.undeliverable` | Couldn't be delivered | تعذّر التسليم | draft | Phase 6 M4 Sent tab |
| `sent.read` | Read | تمت القراءة | draft | Phase 6 M4 Sent tab |
| `sent.unschedule` | Unschedule | إلغاء الجدولة | draft | Phase 6 M4 Sent tab |
| `sent.unscheduleConfirmTitle` | Unschedule this letter? | هل تريد إلغاء جدولة هذه الرسالة؟ | draft | Phase 6 M4 Sent tab |
| `sent.unscheduleConfirmMessage` | It will go back to your drafts. | ستعود إلى المسودات. | draft | Phase 6 M4 Sent tab |
| `sent.unscheduleConfirmCancel` | Keep scheduled | إبقاء الجدولة | draft | Phase 6 M4 Sent tab |
| `sent.unscheduled` | Moved back to drafts. | أُعيدت الرسالة إلى المسودات. | draft | Phase 6 M4 Sent tab |
| `sent.retry` | Try again | إعادة المحاولة | draft | Phase 6 M4 Sent tab |
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
| `auth.signIn.title` | Sign in | تسجيل الدخول | draft | |
| `auth.signIn.email` | Email | البريد الإلكتروني | draft | |
| `auth.signIn.password` | Password | كلمة المرور | draft | |
| `auth.signIn.submit` | Sign in | تسجيل الدخول | draft | Same string as the title, intentionally (form title vs. button label) |
| `auth.signIn.noAccount` | Don't have an account? | ليس لديك حساب؟ | draft | |
| `auth.signIn.signUpLink` | Sign up | إنشاء حساب | draft | |
| `auth.signIn.forgotPasswordLink` | Forgot password? | نسيت كلمة المرور؟ | draft | |
| `auth.signIn.error.invalid_credentials` | Incorrect email or password. | البريد الإلكتروني أو كلمة المرور غير صحيحة. | draft | Neutral wording: never says which of the two is wrong |
| `auth.signIn.error.email_not_confirmed` | Confirm your email first — check your inbox. | يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من بريدك الوارد. | draft | |
| `auth.signIn.error.over_request_rate_limit` | Too many attempts. Try again in a few minutes. | محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق. | draft | |
| `auth.signIn.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | |
| `auth.signUp.title` | Create account | إنشاء حساب | draft | |
| `auth.signUp.email` | Email | البريد الإلكتروني | draft | |
| `auth.signUp.password` | Password | كلمة المرور | draft | |
| `auth.signUp.submit` | Create account | إنشاء حساب | draft | |
| `auth.signUp.hasAccount` | Already have an account? | لديك حساب بالفعل؟ | draft | |
| `auth.signUp.signInLink` | Sign in | تسجيل الدخول | draft | |
| `auth.signUp.confirmationTitle` | Check your email | تحقق من بريدك الإلكتروني | draft | |
| `auth.signUp.confirmationBody` | We sent a confirmation link to {{email}}. Open it, then sign in. | أرسلنا رابط تأكيد إلى {{email}}. افتحه ثم سجّل الدخول. | draft | `{{email}}` is the address the user typed, always rendered LTR by the platform bidi algorithm |
| `auth.signUp.error.user_already_exists` | An account with this email already exists. | يوجد حساب بهذا البريد الإلكتروني بالفعل. | draft | |
| `auth.signUp.error.weak_password` | Choose a stronger password. | اختر كلمة مرور أقوى. | draft | |
| `auth.signUp.error.email_address_invalid` | Enter a valid email address. | أدخل بريدًا إلكترونيًا صحيحًا. | draft | |
| `auth.signUp.error.over_email_send_rate_limit` | Too many attempts. Try again in a few minutes. | محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق. | draft | |
| `auth.signUp.error.over_request_rate_limit` | Too many attempts. Try again in a few minutes. | محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق. | draft | |
| `auth.signUp.error.signup_disabled` | Sign-up is currently unavailable. | إنشاء الحسابات غير متاح حاليًا. | draft | |
| `auth.signUp.error.email_provider_disabled` | Sign-up is currently unavailable. | إنشاء الحسابات غير متاح حاليًا. | draft | Same wording as signup_disabled: the distinction is not user-actionable |
| `auth.signUp.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | |
| `auth.forgotPassword.title` | Reset password | إعادة تعيين كلمة المرور | draft | |
| `auth.forgotPassword.body` | Enter your email and we'll send you a link to reset your password. | أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور. | draft | |
| `auth.forgotPassword.email` | Email | البريد الإلكتروني | draft | |
| `auth.forgotPassword.submit` | Send reset link | إرسال رابط إعادة التعيين | draft | |
| `auth.forgotPassword.confirmationTitle` | Check your email | تحقق من بريدك الإلكتروني | draft | |
| `auth.forgotPassword.confirmationBody` | If an account exists for {{email}}, we sent a reset link. | إذا كان هناك حساب مرتبط بـ {{email}}، فقد أرسلنا رابط إعادة تعيين. | draft | Deliberately uniform whether or not the account exists (DEC-009's principle applied to reset too) |
| `auth.forgotPassword.backToSignIn` | Back to sign in | العودة إلى تسجيل الدخول | draft | |
| `auth.forgotPassword.error.over_email_send_rate_limit` | Too many attempts. Try again in a few minutes. | محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق. | draft | |
| `auth.forgotPassword.error.over_request_rate_limit` | Too many attempts. Try again in a few minutes. | محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق. | draft | |
| `auth.forgotPassword.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | |
| `auth.onboarding.title` | Set up your profile | إعداد ملفك الشخصي | draft | |
| `auth.onboarding.usernameLabel` | Username | اسم المستخدم | draft | |
| `auth.onboarding.usernameHint` | 3–20 characters: lowercase letters, numbers, underscore. Shown as @username. | من 3 إلى 20 حرفًا: أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط. يظهر باسم @username. | draft | `@username` isolated LTR per DEC-010 when actually rendered next to Arabic text (the hint text itself is plain, the isolation happens in the component) |
| `auth.onboarding.usernameChecking` | Checking… | جارٍ التحقق… | draft | |
| `auth.onboarding.usernameAvailable` | Available | متاح | draft | |
| `auth.onboarding.usernameUnavailable` | Not available | غير متاح | draft | |
| `auth.onboarding.displayNameLabel` | Display name | الاسم المعروض | draft | |
| `auth.onboarding.displayNameHint` | Any language. Shown next to @username. | بأي لغة. يظهر بجانب @username. | draft | |
| `auth.onboarding.discoverableByEmailLabel` | Let people find me by email | السماح للآخرين بالعثور عليّ عبر البريد الإلكتروني | draft | |
| `auth.onboarding.submit` | Continue | متابعة | draft | |
| `auth.onboarding.usernameError.invalid_characters` | Only lowercase letters, numbers and underscore. | أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط. | draft | |
| `auth.onboarding.usernameError.must_start_with_letter` | Must start with a letter. | يجب أن يبدأ بحرف. | draft | |
| `auth.onboarding.usernameError.trailing_underscore` | Can't end with an underscore. | لا يمكن أن ينتهي بشرطة سفلية. | draft | |
| `auth.onboarding.usernameError.consecutive_underscores` | No repeated underscores. | لا يمكن تكرار الشرطة السفلية. | draft | |
| `auth.onboarding.usernameError.too_short` | At least 3 characters. | 3 أحرف على الأقل. | draft | |
| `auth.onboarding.usernameError.too_long` | At most 20 characters. | 20 حرفًا كحد أقصى. | draft | |
| `auth.onboarding.usernameError.reserved` | That username isn't available. | اسم المستخدم هذا غير متاح. | draft | Same wording as "taken", deliberately (DEC-010: never distinguish taken/look-alike/reserved) |
| `auth.onboarding.displayNameError.empty` | Enter a display name. | أدخل اسمًا معروضًا. | draft | |
| `auth.onboarding.displayNameError.too_long` | At most 50 characters. | 50 حرفًا كحد أقصى. | draft | |
| `auth.onboarding.displayNameError.no_letter_or_digit` | Must include a letter or digit. | يجب أن يحتوي على حرف أو رقم. | draft | |
| `auth.onboarding.displayNameError.contains_at` | Can't contain '@'. | لا يمكن أن يحتوي على '@'. | draft | |
| `auth.onboarding.displayNameError.contains_url` | Can't contain a link. | لا يمكن أن يحتوي على رابط. | draft | |
| `auth.onboarding.displayNameError.reserved` | That display name isn't available. | هذا الاسم المعروض غير متاح. | draft | |
| `auth.onboarding.error.not_authenticated` | Your session expired. Sign in again. | انتهت صلاحية جلستك. سجّل الدخول مرة أخرى. | draft | |
| `auth.onboarding.error.invalid_input` | Something's missing. Check the form and try again. | هناك بيانات ناقصة. تحقق من النموذج وحاول مرة أخرى. | draft | |
| `auth.onboarding.error.username_invalid` | That username isn't valid. | اسم المستخدم هذا غير صالح. | draft | |
| `auth.onboarding.error.display_name_invalid` | That display name isn't valid. | الاسم المعروض هذا غير صالح. | draft | |
| `auth.onboarding.error.username_unavailable` | That username isn't available. | اسم المستخدم هذا غير متاح. | draft | |
| `auth.onboarding.error.display_name_reserved` | That display name isn't available. | هذا الاسم المعروض غير متاح. | draft | |
| `auth.onboarding.error.profile_not_found` | Your profile could not be found. Sign in again. | تعذر العثور على ملفك الشخصي. سجّل الدخول مرة أخرى. | draft | |
| `auth.onboarding.error.already_onboarded` | Your profile is already set up. | تم إعداد ملفك الشخصي بالفعل. | draft | |
| `auth.onboarding.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | |
| `auth.signOut` | Sign out | تسجيل الخروج | draft | |
| `compose.recipientLabel` | To | إلى | draft | |
| `compose.noRecipient` | Choose a recipient | اختر المستلم | draft | |
| `compose.recipientChosen` | Recipient selected | تم اختيار المستلم | draft | |
| `compose.send` | Send | إرسال | draft | Phase 6 M2 send button |
| `compose.scheduleOpen` | Schedule… | جدولة… | draft | Phase 6 M3 scheduled send |
| `compose.scheduleConfirm` | Schedule send | جدولة الإرسال | draft | Phase 6 M3 scheduled send |
| `compose.scheduleCancel` | Cancel | إلغاء | draft | Phase 6 M3 scheduled send |
| `compose.sendConfirmTitle` | Send this letter? | هل تريد إرسال هذه الرسالة؟ | draft | Send/schedule confirmation (owner request 2026-09-29) |
| `compose.sendConfirmMessage` | It will be delivered now and can't be changed after delivery. | سيتم تسليمها الآن، ولا يمكن تعديلها بعد التسليم. | draft | Send/schedule confirmation (owner request 2026-09-29) |
| `compose.scheduleConfirmTitle` | Schedule this letter? | هل تريد جدولة هذه الرسالة؟ | draft | Send/schedule confirmation (owner request 2026-09-29) |
| `compose.scheduleConfirmMessage` | It will be delivered on {{when}}. It can be unscheduled until then. | سيتم تسليمها في {{when}}. ويمكن إلغاء جدولتها حتى ذلك الحين. | draft | Send/schedule confirmation (owner request 2026-09-29); `{{when}}` is the full date and time, formatted with Western digits |
| `compose.sendConfirmCancel` | Cancel | إلغاء | draft | Send/schedule confirmation (owner request 2026-09-29) |
| `schedule.timeZone` | Time zone: {{zone}} | المنطقة الزمنية: {{zone}} | draft | Phase 6 M3 schedule picker; zone is an LTR-isolated IANA name + UTC offset |
| `schedule.dayLabel` | Day | اليوم | draft | Phase 6 M3 schedule picker |
| `schedule.dayEarlier` | Move 1 day earlier | تقديم يوم واحد | draft | Phase 6 M3 schedule picker |
| `schedule.dayLater` | Move 1 day later | تأخير يوم واحد | draft | Phase 6 M3 schedule picker |
| `schedule.hourLabel` | Hour | الساعة | draft | Phase 6 M3 schedule picker |
| `schedule.hourEarlier` | Move 1 hour earlier | تقديم ساعة واحدة | draft | Phase 6 M3 schedule picker |
| `schedule.hourLater` | Move 1 hour later | تأخير ساعة واحدة | draft | Phase 6 M3 schedule picker |
| `schedule.minuteLabel` | Minutes (steps of {{step}}) | الدقائق (كل {{step}} دقائق) | draft | Phase 6 M3 schedule picker; `{{step}}` is 5 (SCHEDULE_MINUTE_STEP), Arabic plural form assumes 3-10 |
| `schedule.minuteEarlier` | Move {{step}} minutes earlier | تقديم {{step}} دقائق | draft | Phase 6 M3 schedule picker; `{{step}}` is 5 (SCHEDULE_MINUTE_STEP), Arabic plural form assumes 3-10 |
| `schedule.minuteLater` | Move {{step}} minutes later | تأخير {{step}} دقائق | draft | Phase 6 M3 schedule picker; `{{step}}` is 5 (SCHEDULE_MINUTE_STEP), Arabic plural form assumes 3-10 |
| `profile.connections` | Connection requests | طلبات الاتصال | draft | |
| `profile.myInvite` | My invite link | رابط دعوتي | draft | |
| `profile.privacy` | Privacy | الخصوصية | draft | |
| `discovery.title` | Find people | البحث عن أشخاص | draft | |
| `discovery.searchPlaceholder` | Search by username | ابحث باسم المستخدم | draft | |
| `discovery.searchByEmailPlaceholder` | Or search by email | أو ابحث بالبريد الإلكتروني | draft | |
| `discovery.searchByEmailButton` | Search | بحث | draft | |
| `discovery.noResults` | No results | لا توجد نتائج | draft | |
| `discovery.writeLetter` | Write letter | كتابة رسالة | draft | |
| `discovery.sendRequest` | Send connection request | إرسال طلب اتصال | draft | |
| `discovery.requested` | Requested | تم الإرسال | draft | |
| `discovery.respondToRequest` | Respond to request | الرد على الطلب | draft | |
| `discovery.connected` | Connected | متصل | draft | |
| `discovery.error.query_too_short` | Type at least 3 characters. | اكتب 3 أحرف على الأقل. | draft | |
| `discovery.error.rate_limited` | Too many attempts. Try again in a few minutes. | محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق. | draft | |
| `discovery.error.invalid_input` | Enter a valid email address. | أدخل بريدًا إلكترونيًا صحيحًا. | draft | |
| `discovery.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | |
| `connections.title` | Connection requests | طلبات الاتصال | draft | |
| `connections.incomingTitle` | Incoming | الواردة | draft | |
| `connections.outgoingTitle` | Sent | المرسلة | draft | |
| `connections.emptyTitle` | No connection requests | لا توجد طلبات اتصال | draft | |
| `connections.emptyBody` | Requests you send or receive will appear here. | ستظهر هنا الطلبات التي ترسلها أو تستلمها. | draft | |
| `connections.accept` | Accept | قبول | draft | |
| `connections.decline` | Decline | رفض | draft | |
| `connections.cancel` | Cancel request | إلغاء الطلب | draft | |
| `connections.remove` | Remove connection | إزالة الاتصال | draft | |
| `connections.error.not_found` | That request no longer exists. | هذا الطلب لم يعد موجودًا. | draft | |
| `connections.error.not_pending` | That request was already handled. | تمت معالجة هذا الطلب بالفعل. | draft | |
| `connections.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | |
| `invite.title` | My invite | دعوتي | draft | |
| `invite.shareButton` | Share invite link | مشاركة رابط الدعوة | draft | |
| `invite.regenerateButton` | Generate a new link | إنشاء رابط جديد | draft | |
| `invite.enterCodeLabel` | Have a code? | هل لديك رمز؟ | draft | |
| `invite.enterCodePlaceholder` | Enter code | أدخل الرمز | draft | |
| `invite.enterCodeButton` | Redeem | استخدام الرمز | draft | |
| `invite.redeeming` | Redeeming your invite… | جارٍ استخدام دعوتك… | draft | |
| `invite.redeemedTitle` | You're connected! | تم الاتصال بنجاح! | draft | |
| `invite.redeemedBody` | You can now write letters to each other. | يمكنكما الآن تبادل الرسائل. | draft | |
| `invite.errorTitle` | This invite link didn't work | لم يعمل رابط الدعوة هذا | draft | |
| `invite.backToInbox` | Go to inbox | الذهاب إلى الوارد | draft | |
| `invite.error.invite_not_found` | This invite code is invalid or has expired. | رمز الدعوة غير صالح أو منتهي الصلاحية. | draft | |
| `invite.error.invalid_input` | You can't redeem your own invite. | لا يمكنك استخدام دعوتك الخاصة. | draft | |
| `invite.error.rate_limited` | Too many attempts. Try again in a few minutes. | محاولات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق. | draft | |
| `invite.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | |
| `privacy.title` | Privacy | الخصوصية | draft | |
| `privacy.receiveModeLabel` | Who can send me letters | من يمكنه إرسال رسائل إليّ | draft | |
| `privacy.receiveModeEveryone` | Everyone | الجميع | draft | |
| `privacy.receiveModeInviteOnly` | Only people I'm connected with | المتصلون بي فقط | draft | |
| `privacy.discoverableByUsernameLabel` | Let people find me by username | السماح للآخرين بالعثور عليّ باسم المستخدم | draft | |
| `privacy.discoverableByEmailLabel` | Let people find me by email | السماح للآخرين بالعثور عليّ عبر البريد الإلكتروني | draft | |
| `letters.error.recipient_required` | Choose a recipient first. | اختر المستلم أولًا. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.body_empty` | Write your letter before sending it. | اكتب رسالتك قبل إرسالها. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.cannot_send` | This letter can't be sent to this person. | لا يمكن إرسال هذه الرسالة إلى هذا الشخص. | draft | Phase 6 send/schedule error (DEC-048 M1); neutral: must not reveal a block or the receive setting |
| `letters.error.schedule_in_past` | That time has passed. Choose a later time. | هذا الوقت قد مضى. اختر وقتًا لاحقًا. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.schedule_too_soon` | Choose a time at least 1 minute from now. | اختر وقتًا بعد دقيقة واحدة على الأقل من الآن. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.schedule_too_far` | Choose a time within the next 5 years. | اختر وقتًا خلال 5 سنوات من الآن. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.rate_limited` | Too many letters sent. Try again later. | تم إرسال عدد كبير من الرسائل. حاول مرة أخرى لاحقًا. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.already_delivered` | This letter has already been delivered. | تم تسليم هذه الرسالة بالفعل. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.not_scheduled` | This letter is no longer scheduled. | لم تعد هذه الرسالة مجدولة. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.not_found` | This letter is no longer available. | لم تعد هذه الرسالة متاحة. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.error.unknown` | Something went wrong. Try again. | حدث خطأ ما. حاول مرة أخرى. | draft | Phase 6 send/schedule error (DEC-048 M1) |
| `letters.deletedAccount` | Deleted account | حساب محذوف | draft | Phase 6 M4: shown instead of a deleted account's name |
| `letter.title` | Letter | الرسالة | draft | Phase 6 M6 reading view |
| `letter.from` | From | من | draft | Phase 6 M6 reading view |
| `letter.reply` | Reply | رد | draft | Phase 8 replies |
| `letter.replySubject` | Re: {{subject}} | رد: {{subject}} | draft | Phase 8 replies; `{{subject}}` is the original subject |
| `compose.replyRecipient` | Reply to the letter's sender | رد على مرسل الرسالة | draft | Phase 8 replies |
| `letter.viewConversation` | View conversation | عرض المحادثة | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.deleteForMe` | Delete for me | حذف من عندي | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.deleteConfirmTitle` | Delete this letter for you? | هل تريد حذف هذه الرسالة من عندك؟ | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.deleteConfirmMessage` | It disappears from your lists only. The other person keeps their copy. | ستختفي من قوائمك فقط، ويحتفظ الطرف الآخر بنسخته. | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.block` | Block | حظر | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.blockConfirmTitle` | Block this person? | هل تريد حظر هذا الشخص؟ | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.blockConfirmMessage` | They won't be able to write to you or find you, and they won't be told. | لن يتمكن من مراسلتك أو العثور عليك، ولن يُبلَّغ بذلك. | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.blocked` | Blocked. | تم الحظر. | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `letter.report` | Report | إبلاغ | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `thread.title` | Conversation | المحادثة | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `thread.mine` | Your letter | رسالتك | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `thread.theirs` | Their letter | رسالة واردة | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.title` | Report | إبلاغ | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.reasonLabel` | What's wrong? | ما المشكلة؟ | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.detailsLabel` | Details (optional) | تفاصيل (اختياري) | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.alsoBlock` | Also block this person | حظر هذا الشخص أيضًا | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.submit` | Send report | إرسال البلاغ | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.sent` | Thank you. The report will be reviewed; the person won't be told. | شكرًا لك. ستتم مراجعة البلاغ، ولن يُبلَّغ الشخص بذلك. | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.close` | Done | تم | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.reason.spam` | Spam | رسائل مزعجة | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.reason.harassment` | Harassment | مضايقة | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.reason.inappropriate` | Inappropriate content | محتوى غير لائق | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.reason.impersonation` | Pretending to be someone else | انتحال شخصية | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `report.reason.other` | Something else | سبب آخر | draft | Phase 8/9 (threads, delete-for-me, block, report) |
| `profile.blocked` | Blocked people | المحظورون | draft | Phase 9 (blocked list, account deletion) |
| `profile.deleteAccount` | Delete account | حذف الحساب | draft | Phase 9 (blocked list, account deletion) |
| `profile.deleteAccountTitle` | Delete your account? | هل تريد حذف حسابك؟ | draft | Phase 9 (blocked list, account deletion) |
| `profile.deleteAccountMessage` | Your drafts, scheduled letters, invites and connections will be removed. Letters already delivered stay with their recipients, shown as from a deleted account. | ستُحذف مسوداتك ورسائلك المجدولة ودعواتك واتصالاتك. أما الرسائل التي سُلِّمت فتبقى لدى مستلميها وتظهر كأنها من حساب محذوف. | draft | Phase 9 (blocked list, account deletion) |
| `profile.deleteAccountContinue` | Continue | متابعة | draft | Phase 9 (blocked list, account deletion) |
| `profile.deleteAccountFinalTitle` | This can't be undone | لا يمكن التراجع عن هذا | draft | Phase 9 (blocked list, account deletion) |
| `profile.deleteAccountFinalMessage` | You won't be able to sign in to this account again. | لن تتمكن من تسجيل الدخول إلى هذا الحساب مرة أخرى. | draft | Phase 9 (blocked list, account deletion) |
| `profile.deleteAccountFailed` | The account could not be deleted. Try again. | تعذّر حذف الحساب. حاول مرة أخرى. | draft | Phase 9 (blocked list, account deletion) |
| `blocked.title` | Blocked people | المحظورون | draft | Phase 9 (blocked list, account deletion) |
| `blocked.emptyTitle` | No one blocked | لا يوجد محظورون | draft | Phase 9 (blocked list, account deletion) |
| `blocked.emptyBody` | People you block can't write to you or find you. | لا يمكن للمحظورين مراسلتك أو العثور عليك. | draft | Phase 9 (blocked list, account deletion) |
| `blocked.unblock` | Unblock | إلغاء الحظر | draft | Phase 9 (blocked list, account deletion) |
| `safety.actionsTitle` | Options | خيارات | draft | Phase 9: the … menu (Report / Block) on a person |
| `avatar.title` | Avatar | الصورة الرمزية | draft | Preset avatars (DEC-011) |
| `avatar.change` | Choose avatar | اختيار صورة رمزية | draft | Preset avatars (DEC-011) |
| `avatar.none` | No avatar | بدون صورة رمزية | draft | Preset avatars (DEC-011) |
| `avatar.option` | Avatar {{number}} | الصورة الرمزية {{number}} | draft | Preset avatars (DEC-011); `{{number}}` is 1-24, for screen readers |
