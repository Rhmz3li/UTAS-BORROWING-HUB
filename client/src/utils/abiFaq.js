/** FAQ Support — borrowing rules, return deadlines, resource availability, and hub how-to. */

export const FAQ_SUPPORT_INTRO =
    'FAQ Support: I can answer frequently asked questions about borrowing rules, return deadlines, resource availability, reservations, payments, returns, and notifications. Tap a topic below or type your question.';

export const QUICK_QUESTIONS = [
    'What are the borrowing rules?',
    'How do return deadlines work?',
    'How do I check resource availability?',
    'How do I borrow a device?',
    'How do I reserve a device?',
    'How do card payments work?',
    'How can I return an item?',
    'Where do I see notifications?'
];

export const QUICK_REPLIES = {
    'What are the borrowing rules?':
        'Borrowing rules in this hub:\n\n• Start from Resources or a resource’s detail page, choose an available item, open Borrow, accept the terms, and set the borrow/due dates as the form shows.\n• If the resource has a department set, only users whose profile department matches that resource’s department can borrow or reserve it. Admin and Assistant roles bypass this rule.\n• If a refundable security deposit is required and you choose Card, complete the payment from Payments first; the request is then ready for staff/admin review. If no card deposit is required, the request still goes through admin approval as designed.\n• You will get updates in Notifications when your request is approved or rejected.',
    'How do return deadlines work?':
        'Return deadlines:\n\n• Each active borrow has a due date shown in My Borrows (and in your loan details).\n• Return the physical item on or before that due date to avoid overdue status.\n• To start a return: My Borrows → your active borrow → request return. Hub staff must confirm the physical return in the system before the borrow is fully completed.\n• If you are unsure of a specific date, open My Borrows and check the due date for that resource.',
    'How do I check resource availability?':
        'Resource availability:\n\n• Browse the catalog under Resources; use search and filters to find items.\n• On a resource’s detail page (/resources/:id), use the availability check for a specific borrow date before you confirm a borrow — the app checks whether the item can be borrowed for that period.\n• Availability also depends on stock (available quantity) and whether the item is already on loan for overlapping dates.\n• If a resource is restricted by department, your profile department must match to borrow or reserve.',
    'How do I borrow a device?':
        'To borrow: open Resources, pick an available device, click Borrow, accept the terms, set the due/borrow dates as prompted, and submit. If a card deposit is required, pay from Payments first, then wait for admin approval. Otherwise follow the same approval flow without a card step.',
    'How do I reserve a device?':
        'To reserve: open Resources or the resource detail page, click Reserve, choose pickup and expiry dates, accept the terms, and submit. If a card deposit is required, complete it in Payments before admin review.',
    'How do card payments work?':
        'When you choose Card for a deposit, the system creates a payment record and you complete card payment from the Payments page. After successful payment the status becomes Paid and the admin is notified that your borrow or reservation request is ready for review.',
    'How can I return an item?':
        'Go to My Borrows, find the active borrow, and request return. Physical return must be confirmed by hub staff in the system before the process is fully completed.',
    'Where do I see notifications?':
        'Open Notifications from the sidebar. You will see approvals, rejections, payment events, returns, refunds, and other system messages. Use Notification settings for preferences where available.'
};

/** Keyword groups for paraphrased / Arabic questions (not only exact quick-pill text). */
const FAQ_TOPICS = [
    {
        id: 'borrowing_rules',
        keywords: [
            'borrowing rule', 'borrow rule', 'rules for borrow', 'loan rule', 'policy', 'terms',
            'department', 'who can borrow', 'approval', 'deposit required', 'security deposit',
            'قواعد الاستعارة', 'شروط الاستعارة', 'قوانين الاستعارة', 'سياسة الاستعارة', 'شروط الاقتراض',
            'من يستطيع', 'موافقة الادمن', 'عربون', 'قسم'
        ],
        reply: QUICK_REPLIES['What are the borrowing rules?']
    },
    {
        id: 'return_deadlines',
        keywords: [
            'return deadline', 'due date', 'when return', 'overdue', 'late return', 'days left',
            'deadline', 'return by', 'how long', 'loan period',
            'موعد الارجاع', 'موعد الإرجاع', 'تاريخ الاستحقاق', 'متى ارجع', 'متى أرجع',
            'تأخير', 'متأخر', 'فات الموعد', 'كم يوم'
        ],
        reply: QUICK_REPLIES['How do return deadlines work?']
    },
    {
        id: 'availability',
        keywords: [
            'availability', 'available', 'in stock', 'check if available', 'is it free',
            'can i borrow', 'resource available', 'catalog', 'search resource',
            'التوفر', 'متاح', 'متوفرة', 'هل متوفر', 'الموارد المتاحة', 'فحص التوفر', 'هل يمكنني استعارة'
        ],
        reply: QUICK_REPLIES['How do I check resource availability?']
    },
    {
        id: 'borrow_howto',
        keywords: ['how do i borrow', 'how to borrow', 'borrow a device', 'checkout', 'كيف استعير', 'كيف أستعير', 'خطوات الاستعارة'],
        reply: QUICK_REPLIES['How do I borrow a device?']
    },
    {
        id: 'reserve_howto',
        keywords: ['how do i reserve', 'how to reserve', 'reservation', 'pickup date', 'كيف احجز', 'كيف أحجز', 'حجز'],
        reply: QUICK_REPLIES['How do I reserve a device?']
    },
    {
        id: 'payments',
        keywords: ['card payment', 'pay deposit', 'my payments', 'cash payment', 'دفع', 'بطاقة', 'المدفوعات'],
        reply: QUICK_REPLIES['How do card payments work?']
    },
    {
        id: 'return_howto',
        keywords: ['how can i return', 'how to return', 'request return', 'ارجاع', 'إرجاع', 'ارجع الجهاز'],
        reply: QUICK_REPLIES['How can I return an item?']
    },
    {
        id: 'notifications',
        keywords: ['notification', 'alert', 'message center', 'اشعار', 'إشعار', 'الاشعارات'],
        reply: QUICK_REPLIES['Where do I see notifications?']
    }
];

/**
 * Match user text to an FAQ reply (exact quick question, then keyword topics).
 * @returns {string|null}
 */
export function matchAbiFaq(messageText = '') {
    const trimmed = String(messageText || '').trim();
    if (!trimmed) return null;

    if (QUICK_REPLIES[trimmed]) {
        return QUICK_REPLIES[trimmed];
    }

    const lower = trimmed.toLowerCase();
    let best = null;
    let bestScore = 0;

    for (const topic of FAQ_TOPICS) {
        let score = 0;
        for (const kw of topic.keywords) {
            const k = kw.toLowerCase();
            if (lower.includes(k) || trimmed.includes(kw)) {
                score += Math.max(2, Math.min(k.length, 12));
            }
        }
        if (score > bestScore) {
            bestScore = score;
            best = topic.reply;
        }
    }

    return bestScore >= 2 ? best : null;
}
