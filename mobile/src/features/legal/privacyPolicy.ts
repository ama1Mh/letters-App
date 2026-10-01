/**
 * Privacy policy text (OPEN-6, DEC-053). Draft written from what the app and database actually do;
 * it must be reviewed (legal + the owner's Arabic review) before release, and updated whenever data
 * handling changes (new processor, analytics, crash reporting, retention). Kept here rather than in
 * ar.json/en.json because it is a document, not UI copy; both languages change together.
 * `{{appName}}`, `{{email}}` and `{{date}}` are filled in by LegalDocumentView.
 */
import { list, p, type LegalDocument } from './document';

const en = {
  updatedLabel: 'Last updated: {{date}}',
  sections: [
    {
      heading: 'In short',
      blocks: [
        p(
          '{{appName}} lets you write letters to other people and deliver them now or at a time you choose. We collect only what we need to do that. We do not show ads, we do not sell your data, and we do not use tracking or analytics tools.',
        ),
        p(
          'Your letters are visible only to you and the person you send them to. They are protected in transit and stored encrypted by our hosting provider, but they are not end-to-end encrypted, so the service itself can technically access them (see "Who can see your information").',
        ),
      ],
    },
    {
      heading: 'What we collect',
      blocks: [
        list(
          'Account: your email address and whether it is verified, and your password, which is stored only as a secure hash by our sign-in provider. We never see your password.',
          'Profile: your username, display name, the preset avatar you pick, your app language, and your settings (who can send you letters, whether people can find you by username or by email, notifications).',
          'Letters and drafts: subject, text, design choices, recipient, scheduled time, delivery status, when a letter was delivered and read, and which letter it replies to. Drafts are saved on your device and synced to our servers so they are not lost.',
          'Connections and invites: connection requests, the people you are connected with, and invite codes you create or use.',
          'Safety: the people you block, and reports you send (the reason, any details you add, and the letter or person reported).',
          'Device: a push-notification token, the platform (for example Android) and the app version, used only to send you notifications.',
          'Crash reports: technical details about a crash or an unexpected error in the app, used only to fix it (see "Services we use").',
          'Abuse prevention: short-lived counts of some actions, such as searches and connection requests, so we can limit misuse.',
        ),
        p(
          'We do not collect your location, contacts, photos or files, or advertising identifiers, and we do not use advertising or analytics tools.',
        ),
      ],
    },
    {
      heading: 'How we use it',
      blocks: [
        list(
          'To run the service: create your account, save your drafts, deliver letters at the time you chose, and show your inbox, sent letters and conversations.',
          'To let people find and contact you only in the ways you allow.',
          'To notify you when a letter arrives, if you keep notifications on.',
          'To keep people safe: enforce blocks and sending rules, review reports and prevent abuse.',
          'To send account emails, such as email confirmation and password reset.',
        ),
        p(
          'We do not use your letters or profile for advertising, we do not sell or rent personal information, and we do not use your letters to train AI models.',
        ),
      ],
    },
    {
      heading: 'Who can see your information',
      blocks: [
        list(
          'A letter is visible only to its sender and its recipient. Once delivered, it can no longer be edited.',
          'Other users can see your username, display name and avatar. Your email address is never shown to other users.',
          'People can find you by email only if you turn that on, and only by typing your exact address. You can also stop people from finding you by username.',
          'When you open a letter, its sender can see that it was read.',
          'People you block cannot send you letters or connection requests, and they are not told that they were blocked.',
          'Our team accesses personal information only when it is needed to run or secure the service, to review a report (including the reported letter), or when the law requires it.',
        ),
      ],
    },
    {
      heading: 'Services we use',
      blocks: [
        p('We share information only with providers that help us run the service:'),
        list(
          'Supabase: hosting, database, sign-in and account emails.',
          "Expo push notification service and Google Firebase Cloud Messaging: delivering notifications to your device. A notification contains the sender's name and username and a reference to the letter, never the letter's text.",
          'Sentry: crash reports. When the app crashes or hits an unexpected error, it sends a technical report (device model, Android version, app version and where in the code the error happened). Reports never include your letters, email address, name, username or IP address.',
        ),
        p(
          "These providers process data on our behalf and may store it in countries other than yours. We may also disclose information if the law requires it or to protect people's safety.",
        ),
      ],
    },
    {
      heading: 'How long we keep it',
      blocks: [
        list(
          'Your account information is kept while you have an account.',
          '"Delete for me" removes a letter from your lists; the other person keeps their copy.',
          'When you delete your account, we remove your sign-in details, drafts, letters that were scheduled but not yet delivered, invites, connections, blocks, devices and pending notifications, and we clear your profile. Letters that were already delivered stay with the other person and are shown as coming from a deleted account. Your username stays reserved so no one else can use it to pretend to be you.',
          'Abuse-prevention counts are deleted after about 2 days, records of sent notifications after 30 days, and crash reports after 90 days.',
          'Reports are kept as long as they are needed for safety and legal reasons.',
          "Copies can remain in our providers' backups for a limited time before they are overwritten.",
        ),
      ],
    },
    {
      heading: 'Security',
      blocks: [
        p(
          "Data is encrypted in transit and at rest by our hosting provider. Database rules make sure each person can reach only their own information and the letters they sent or received. On your phone, your sign-in session is kept in the device's secure storage. No system is perfectly secure, so please keep your password safe and tell us if you think your account was misused.",
        ),
      ],
    },
    {
      heading: 'Your choices and rights',
      blocks: [
        list(
          'You can view and change your profile and settings at any time in the app.',
          'You can control who can send you letters, whether people can find you, and whether you get notifications.',
          'You can block or report people, delete letters for yourself, and delete your account in the app (Profile > Delete account).',
        ),
        p(
          'Depending on where you live, you may have the right to access, correct or delete your personal information, to get a copy of it, or to object to or restrict how we use it. To make a request, contact us at {{email}}. We may need to confirm that the account is yours.',
        ),
      ],
    },
    {
      heading: 'Children',
      blocks: [
        p(
          '{{appName}} is not intended for children under 13, or under the minimum age required in your country. If you believe a child has created an account, contact us and we will delete it.',
        ),
      ],
    },
    {
      heading: 'Changes to this policy',
      blocks: [
        p(
          'If we change this policy, we will update the date above, and for important changes we will tell you in the app before they take effect.',
        ),
      ],
    },
    {
      heading: 'Contact',
      blocks: [p('Questions or requests about your privacy: {{email}}')],
    },
  ],
};

const ar = {
  updatedLabel: 'آخر تحديث: {{date}}',
  sections: [
    {
      heading: 'باختصار',
      blocks: [
        p(
          'يتيح لك {{appName}} كتابة رسائل إلى الآخرين وإيصالها فورًا أو في الوقت الذي تختاره. ولا نجمع إلا ما نحتاج إليه لذلك. لا نعرض إعلانات، ولا نبيع بياناتك، ولا نستخدم أدوات تتبع أو تحليلات.',
        ),
        p(
          'لا يرى رسائلك إلا أنت ومن ترسلها إليه. وهي محمية أثناء نقلها ومخزنة مشفرة لدى مزود الاستضافة، لكنها ليست مشفرة تشفيرًا تامًا بين الطرفين، لذا يمكن للخدمة نفسها تقنيًا الوصول إليها (انظر «من يمكنه رؤية معلوماتك»).',
        ),
      ],
    },
    {
      heading: 'ما الذي نجمعه',
      blocks: [
        list(
          'الحساب: بريدك الإلكتروني وما إذا كان مؤكدًا، وكلمة المرور التي لا يحفظها مزود تسجيل الدخول إلا بصيغة مجزأة آمنة. نحن لا نرى كلمة المرور أبدًا.',
          'الملف الشخصي: اسم المستخدم، والاسم المعروض، والصورة الرمزية الجاهزة التي تختارها، ولغة التطبيق، وإعداداتك (من يمكنه إرسال رسائل إليك، وهل يمكن العثور عليك باسم المستخدم أو بالبريد الإلكتروني، والإشعارات).',
          'الرسائل والمسودات: الموضوع، والنص، واختيارات التصميم، والمستلم، والموعد المحدد، وحالة التسليم، ووقت تسليم الرسالة وقراءتها، والرسالة التي تردّ عليها. تُحفظ المسودات على جهازك وتُزامَن مع خوادمنا حتى لا تضيع.',
          'الاتصالات والدعوات: طلبات الاتصال، والأشخاص المتصلون بك، ورموز الدعوة التي تنشئها أو تستخدمها.',
          'الأمان: الأشخاص الذين تحظرهم، والبلاغات التي ترسلها (السبب، وأي تفاصيل تضيفها، والرسالة أو الشخص المُبلَّغ عنه).',
          'الجهاز: رمز الإشعارات، والنظام (مثل Android)، وإصدار التطبيق، ولا نستخدمها إلا لإرسال الإشعارات إليك.',
          'تقارير الأعطال: تفاصيل تقنية عن تعطل التطبيق أو أي خطأ غير متوقع فيه، ولا نستخدمها إلا لإصلاحه (انظر «الخدمات التي نستخدمها»).',
          'منع إساءة الاستخدام: أعداد مؤقتة لبعض الإجراءات، مثل عمليات البحث وطلبات الاتصال، لنتمكن من الحد من إساءة الاستخدام.',
        ),
        p(
          'لا نجمع موقعك، ولا جهات اتصالك، ولا صورك أو ملفاتك، ولا معرّفات الإعلانات، ولا نستخدم أدوات إعلانية أو تحليلية.',
        ),
      ],
    },
    {
      heading: 'كيف نستخدم معلوماتك',
      blocks: [
        list(
          'لتشغيل الخدمة: إنشاء حسابك، وحفظ مسوداتك، وتسليم الرسائل في الوقت الذي اخترته، وعرض الوارد والرسائل المرسلة والمحادثات.',
          'لتمكين الآخرين من العثور عليك والتواصل معك بالطرق التي تسمح بها فقط.',
          'لإعلامك عند وصول رسالة، إن أبقيت الإشعارات مفعّلة.',
          'لحماية المستخدمين: تطبيق الحظر وقواعد الإرسال، ومراجعة البلاغات، ومنع إساءة الاستخدام.',
          'لإرسال رسائل الحساب الإلكترونية، مثل تأكيد البريد الإلكتروني وإعادة تعيين كلمة المرور.',
        ),
        p(
          'لا نستخدم رسائلك أو ملفك الشخصي للإعلانات، ولا نبيع المعلومات الشخصية أو نؤجرها، ولا نستخدم رسائلك لتدريب نماذج الذكاء الاصطناعي.',
        ),
      ],
    },
    {
      heading: 'من يمكنه رؤية معلوماتك',
      blocks: [
        list(
          'لا يرى الرسالة إلا مرسلها ومستلمها. وبعد تسليمها لا يمكن تعديلها.',
          'يمكن للمستخدمين الآخرين رؤية اسم المستخدم والاسم المعروض والصورة الرمزية. ولا يُعرض بريدك الإلكتروني للمستخدمين الآخرين أبدًا.',
          'لا يمكن العثور عليك بالبريد الإلكتروني إلا إذا فعّلت ذلك، وبكتابة عنوانك كاملًا فقط. ويمكنك أيضًا منع العثور عليك باسم المستخدم.',
          'عندما تفتح رسالة، يمكن لمرسلها أن يرى أنها قُرئت.',
          'لا يمكن لمن تحظرهم إرسال رسائل أو طلبات اتصال إليك، ولا يُبلَّغون بأنهم محظورون.',
          'لا يصل فريقنا إلى المعلومات الشخصية إلا عند الحاجة إلى تشغيل الخدمة أو تأمينها، أو لمراجعة بلاغ (بما في ذلك الرسالة المُبلَّغ عنها)، أو عندما يقتضي القانون ذلك.',
        ),
      ],
    },
    {
      heading: 'الخدمات التي نستخدمها',
      blocks: [
        p('لا نشارك المعلومات إلا مع مزودين يساعدوننا في تشغيل الخدمة:'),
        list(
          'Supabase: الاستضافة، وقاعدة البيانات، وتسجيل الدخول، ورسائل الحساب الإلكترونية.',
          'خدمة إشعارات Expo وخدمة Google Firebase Cloud Messaging: لإيصال الإشعارات إلى جهازك. يتضمن الإشعار اسم المرسل واسم المستخدم الخاص به ومرجعًا إلى الرسالة، ولا يتضمن نص الرسالة أبدًا.',
          'Sentry: تقارير الأعطال. عندما يتعطل التطبيق أو يواجه خطأً غير متوقع، يرسل تقريرًا تقنيًا (طراز الجهاز، وإصدار Android، وإصدار التطبيق، وموضع الخطأ في الشيفرة البرمجية). لا تتضمن التقارير أبدًا رسائلك أو بريدك الإلكتروني أو اسمك أو اسم المستخدم أو عنوان IP الخاص بك.',
        ),
        p(
          'يعالج هؤلاء المزودون البيانات نيابة عنا، وقد يخزنونها في دول غير دولتك. وقد نفصح عن المعلومات أيضًا إذا اقتضى القانون ذلك أو لحماية سلامة الأشخاص.',
        ),
      ],
    },
    {
      heading: 'مدة الاحتفاظ بالمعلومات',
      blocks: [
        list(
          'نحتفظ بمعلومات حسابك ما دام لديك حساب.',
          'يزيل خيار «حذف لديّ» الرسالة من قوائمك، ويحتفظ الطرف الآخر بنسخته.',
          'عند حذف حسابك نزيل بيانات تسجيل الدخول، والمسودات، والرسائل المجدولة التي لم تُسلَّم بعد، والدعوات، والاتصالات، والحظر، والأجهزة، والإشعارات المعلقة، ونمسح ملفك الشخصي. أما الرسائل التي سُلِّمت بالفعل فتبقى لدى الطرف الآخر وتظهر على أنها من حساب محذوف. ويظل اسم المستخدم محجوزًا حتى لا يستخدمه أحد لانتحال شخصيتك.',
          'تُحذف أعداد منع إساءة الاستخدام بعد يومين تقريبًا، وسجلات الإشعارات المرسلة بعد 30 يومًا، وتقارير الأعطال بعد 90 يومًا.',
          'نحتفظ بالبلاغات ما دامت لازمة لأسباب تتعلق بالسلامة أو بالقانون.',
          'قد تبقى نسخ في النسخ الاحتياطية لدى مزودينا مدة محدودة قبل استبدالها.',
        ),
      ],
    },
    {
      heading: 'الأمان',
      blocks: [
        p(
          'يشفّر مزود الاستضافة البيانات أثناء نقلها وأثناء تخزينها. وتضمن قواعد قاعدة البيانات ألا يصل كل شخص إلا إلى معلوماته والرسائل التي أرسلها أو استلمها. وعلى هاتفك تُحفظ جلسة تسجيل الدخول في التخزين الآمن للجهاز. لا يوجد نظام آمن تمامًا، لذا نرجو الحفاظ على كلمة المرور وإبلاغنا إذا ظننت أن حسابك استُخدم دون إذنك.',
        ),
      ],
    },
    {
      heading: 'خياراتك وحقوقك',
      blocks: [
        list(
          'يمكنك عرض ملفك الشخصي وإعداداتك وتغييرها في أي وقت من التطبيق.',
          'يمكنك التحكم في من يرسل إليك الرسائل، وفي إمكانية العثور عليك، وفي تلقي الإشعارات.',
          'يمكنك حظر الأشخاص أو الإبلاغ عنهم، وحذف الرسائل لديك، وحذف حسابك من التطبيق (الملف الشخصي ثم حذف الحساب).',
        ),
        p(
          'بحسب مكان إقامتك، قد يحق لك الوصول إلى معلوماتك الشخصية أو تصحيحها أو حذفها، أو الحصول على نسخة منها، أو الاعتراض على طريقة استخدامنا لها أو تقييدها. لتقديم طلب، تواصل معنا عبر {{email}}. وقد نحتاج إلى التحقق من أن الحساب يخصك.',
        ),
      ],
    },
    {
      heading: 'الأطفال',
      blocks: [
        p(
          'لم يُصمَّم {{appName}} للأطفال دون 13 عامًا، أو دون الحد الأدنى للسن المعمول به في بلدك. إذا كنت تعتقد أن طفلًا أنشأ حسابًا، فتواصل معنا وسنحذفه.',
        ),
      ],
    },
    {
      heading: 'التغييرات على هذه السياسة',
      blocks: [
        p(
          'إذا غيّرنا هذه السياسة فسنحدّث التاريخ أعلاه، وسنعلمك داخل التطبيق بالتغييرات المهمة قبل سريانها.',
        ),
      ],
    },
    {
      heading: 'التواصل',
      blocks: [p('للأسئلة أو الطلبات المتعلقة بخصوصيتك: {{email}}')],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = { updated: '2026-10-01', content: { en, ar } };
