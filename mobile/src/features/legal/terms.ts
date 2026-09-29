/**
 * Terms of service text (OPEN-6, DEC-054). Draft written from how the app actually behaves; it
 * must be reviewed (legal + the owner's Arabic review) before release. No governing law, operator
 * name or fees are stated yet: those are the owner's decisions (see DEC-054).
 * `{{appName}}`, `{{email}}` and `{{date}}` are filled in by LegalDocumentView.
 */
import { list, p, type LegalDocument } from './document';

const en = {
  updatedLabel: 'Last updated: {{date}}',
  sections: [
    {
      heading: 'Agreeing to these terms',
      blocks: [
        p(
          'These terms apply when you use {{appName}}. By creating an account or using the app, you agree to them and to how we handle your data as described in our privacy policy. If you do not agree, please do not use {{appName}}.',
        ),
      ],
    },
    {
      heading: 'Who can use {{appName}}',
      blocks: [
        list(
          'You must be at least 13 years old, or the minimum age required in your country if it is higher.',
          'An account is for one person. Use an email address you control, and keep your password to yourself.',
          'You are responsible for what happens in your account. Tell us at {{email}} if you think someone else is using it.',
        ),
      ],
    },
    {
      heading: 'Usernames and profiles',
      blocks: [
        p(
          'Your username and display name must not pretend to be another person, a brand or {{appName}} itself, and must not be offensive. Some names are reserved. We may change or remove a username or display name that breaks these rules.',
        ),
      ],
    },
    {
      heading: 'Your letters',
      blocks: [
        list(
          'What you write belongs to you. You give us permission to store, process and deliver your letters and drafts only as needed to run {{appName}} for you and the people you write to.',
          'Once a letter is delivered, it cannot be edited or taken back. Before delivery, you can cancel or change a scheduled letter.',
          'A scheduled letter is delivered at the time you chose, usually within a minute. It is not delivered if, before that time, the recipient blocks you or changes who can send them letters; it is then marked as undeliverable.',
          'You are responsible for what you send. Only send letters you have the right to send.',
        ),
      ],
    },
    {
      heading: 'What is not allowed',
      blocks: [
        p('When using {{appName}}, do not:'),
        list(
          'harass, threaten, bully or intimidate anyone, or promote hatred or violence;',
          'send spam, chain letters, advertising or bulk messages people did not ask for;',
          'send anything illegal, or any sexual content involving minors;',
          "pretend to be someone else, or share other people's private information without their permission;",
          'send links to malware or scams, or try to trick people into giving personal information;',
          'get around blocks, limits or other safety features, including by creating new accounts;',
          'try to break into, overload, copy or scrape the service, or use it in automated ways.',
        ),
      ],
    },
    {
      heading: 'Safety and enforcement',
      blocks: [
        p(
          'You can block or report anyone at any time. We review reports and may remove content, limit features, or suspend or delete accounts that break these terms or the law, and we may report illegal content to the authorities. We try to act fairly, but we do not read letters routinely and we cannot promise to catch every problem.',
        ),
      ],
    },
    {
      heading: 'The service',
      blocks: [
        list(
          'We may change, add or remove features, and the service may sometimes be unavailable, for example during maintenance.',
          'Notifications can be delayed or blocked by your phone or network. Your inbox is always the place to check for letters.',
          'Letters are stored so you can read them again, but please keep your own copy of anything important.',
        ),
      ],
    },
    {
      heading: 'Ending your use',
      blocks: [
        p(
          'You can stop using {{appName}} and delete your account at any time in the app (Profile > Delete account). Our privacy policy explains what is removed and what stays. We may suspend or close an account that breaks these terms; where it is reasonable, we will tell you why.',
        ),
      ],
    },
    {
      heading: 'Disclaimers and liability',
      blocks: [
        p(
          '{{appName}} is provided "as is". To the extent the law allows, we do not promise that it will always be available, error-free or suitable for a particular purpose, and we are not responsible for what other users write or send. To the extent the law allows, we are not liable for indirect or consequential losses arising from your use of the service. Nothing in these terms limits rights you have under consumer-protection laws that cannot be waived.',
        ),
      ],
    },
    {
      heading: 'Changes to these terms',
      blocks: [
        p(
          'We may update these terms. We will update the date above, and for important changes we will tell you in the app before they take effect. If you keep using {{appName}} after that, the new terms apply.',
        ),
      ],
    },
    {
      heading: 'Contact',
      blocks: [p('Questions about these terms: {{email}}')],
    },
  ],
};

const ar = {
  updatedLabel: 'آخر تحديث: {{date}}',
  sections: [
    {
      heading: 'الموافقة على هذه الشروط',
      blocks: [
        p(
          'تسري هذه الشروط عند استخدامك {{appName}}. وبإنشائك حسابًا أو استخدامك التطبيق فإنك توافق عليها وعلى طريقة تعاملنا مع بياناتك كما هو موضح في سياسة الخصوصية. وإن لم توافق، فنرجو ألا تستخدم {{appName}}.',
        ),
      ],
    },
    {
      heading: 'من يمكنه استخدام {{appName}}',
      blocks: [
        list(
          'يجب ألا يقل عمرك عن 13 عامًا، أو عن الحد الأدنى للسن المعمول به في بلدك إن كان أعلى.',
          'الحساب لشخص واحد. استخدم بريدًا إلكترونيًا تملكه، واحتفظ بكلمة المرور لنفسك.',
          'أنت مسؤول عما يحدث في حسابك. أبلغنا عبر {{email}} إذا ظننت أن شخصًا آخر يستخدمه.',
        ),
      ],
    },
    {
      heading: 'أسماء المستخدمين والملفات الشخصية',
      blocks: [
        p(
          'يجب ألا ينتحل اسم المستخدم أو الاسم المعروض شخصية شخص آخر أو علامة تجارية أو {{appName}} نفسه، وألا يكون مسيئًا. بعض الأسماء محجوزة. وقد نغيّر اسم مستخدم أو اسمًا معروضًا يخالف هذه القواعد أو نزيله.',
        ),
      ],
    },
    {
      heading: 'رسائلك',
      blocks: [
        list(
          'ما تكتبه ملك لك. وتمنحنا الإذن بتخزين رسائلك ومسوداتك ومعالجتها وتسليمها بالقدر اللازم فقط لتشغيل {{appName}} لك وللأشخاص الذين تراسلهم.',
          'بعد تسليم الرسالة لا يمكن تعديلها أو استرجاعها. وقبل التسليم يمكنك إلغاء الرسالة المجدولة أو تغييرها.',
          'تُسلَّم الرسالة المجدولة في الوقت الذي اخترته، وعادة خلال دقيقة. ولا تُسلَّم إذا حظرك المستلم قبل ذلك الوقت أو غيّر إعداد من يمكنه مراسلته، وعندئذ توسم بأنها تعذّر تسليمها.',
          'أنت مسؤول عما ترسله. لا ترسل إلا الرسائل التي يحق لك إرسالها.',
        ),
      ],
    },
    {
      heading: 'ما لا يُسمح به',
      blocks: [
        p('عند استخدام {{appName}}، لا يجوز لك:'),
        list(
          'مضايقة أي شخص أو تهديده أو التنمر عليه أو ترهيبه، أو الترويج للكراهية أو العنف؛',
          'إرسال رسائل مزعجة أو رسائل متسلسلة أو إعلانات أو رسائل جماعية لم يطلبها أحد؛',
          'إرسال أي محتوى غير قانوني، أو أي محتوى جنسي يتعلق بالقاصرين؛',
          'انتحال شخصية غيرك، أو مشاركة المعلومات الخاصة بالآخرين دون إذنهم؛',
          'إرسال روابط لبرمجيات ضارة أو عمليات احتيال، أو محاولة خداع الناس لتقديم معلومات شخصية؛',
          'التحايل على الحظر أو الحدود أو ميزات الأمان الأخرى، بما في ذلك بإنشاء حسابات جديدة؛',
          'محاولة اختراق الخدمة أو إثقالها أو نسخها أو جمع بياناتها آليًا، أو استخدامها بطرق آلية.',
        ),
      ],
    },
    {
      heading: 'الأمان وتطبيق الشروط',
      blocks: [
        p(
          'يمكنك حظر أي شخص أو الإبلاغ عنه في أي وقت. نراجع البلاغات، وقد نزيل محتوى أو نقيّد ميزات أو نعلّق الحسابات التي تخالف هذه الشروط أو القانون أو نحذفها، وقد نبلغ السلطات عن المحتوى غير القانوني. نسعى إلى التصرف بإنصاف، لكننا لا نقرأ الرسائل بصورة روتينية ولا يمكننا أن نعد باكتشاف كل مشكلة.',
        ),
      ],
    },
    {
      heading: 'الخدمة',
      blocks: [
        list(
          'قد نغيّر الميزات أو نضيفها أو نزيلها، وقد تكون الخدمة غير متاحة أحيانًا، مثلًا أثناء الصيانة.',
          'قد يؤخر هاتفك أو شبكتك الإشعارات أو يمنعها. صندوق الوارد هو دائمًا المكان الذي تتحقق فيه من رسائلك.',
          'تُحفظ الرسائل لتتمكن من قراءتها مجددًا، لكن نرجو الاحتفاظ بنسختك الخاصة من أي شيء مهم.',
        ),
      ],
    },
    {
      heading: 'إنهاء استخدامك',
      blocks: [
        p(
          'يمكنك التوقف عن استخدام {{appName}} وحذف حسابك في أي وقت من التطبيق (الملف الشخصي ثم حذف الحساب). وتوضح سياسة الخصوصية ما يُحذف وما يبقى. وقد نعلّق حسابًا يخالف هذه الشروط أو نغلقه، وسنخبرك بالسبب متى كان ذلك معقولًا.',
        ),
      ],
    },
    {
      heading: 'إخلاء المسؤولية وحدودها',
      blocks: [
        p(
          'يُقدَّم {{appName}} «كما هو». وفي الحدود التي يسمح بها القانون، لا نتعهد بأن يكون متاحًا دائمًا أو خاليًا من الأخطاء أو مناسبًا لغرض معين، ولسنا مسؤولين عما يكتبه المستخدمون الآخرون أو يرسلونه. وفي الحدود التي يسمح بها القانون، لسنا مسؤولين عن الخسائر غير المباشرة أو التبعية الناتجة عن استخدامك الخدمة. ولا يحدّ أي شيء في هذه الشروط من الحقوق التي تمنحك إياها قوانين حماية المستهلك ولا يجوز التنازل عنها.',
        ),
      ],
    },
    {
      heading: 'التغييرات على هذه الشروط',
      blocks: [
        p(
          'قد نحدّث هذه الشروط. وسنحدّث التاريخ أعلاه، وسنعلمك داخل التطبيق بالتغييرات المهمة قبل سريانها. وإذا واصلت استخدام {{appName}} بعد ذلك، تسري الشروط الجديدة.',
        ),
      ],
    },
    {
      heading: 'التواصل',
      blocks: [p('للأسئلة المتعلقة بهذه الشروط: {{email}}')],
    },
  ],
};

export const TERMS: LegalDocument = { updated: '2026-09-29', content: { en, ar } };
