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
