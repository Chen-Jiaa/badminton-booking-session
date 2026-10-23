/** One question. `id` is what `/faq?q=<id>` opens, so keep ids stable. */
export interface FaqItem {
  id: string;
  question: string;
  answer: string[];
}

export interface FaqSection {
  title: string;
  items: FaqItem[];
}

/**
 * Plain wording of how the app behaves. Keep it in step with docs/sessions.md:
 * the 24h window is LATE_CANCEL_WINDOW_MS, the guest cap is GUEST_LIMIT, and the
 * RM20 deposit is the default `minBalance` (hosts can change it per session).
 */
export const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "Account & profile",
    items: [
      {
        id: "phone",
        question: "Why should I add my phone number?",
        answer: [
          "Add your WhatsApp number on your Profile page. If a game is changed or cancelled at the last minute, the host or an admin can contact you quickly.",
          "Only the host of your session and the admins can see it. Other players can't.",
        ],
      },
    ],
  },
  {
    title: "Wallet & payments",
    items: [
      {
        id: "min-balance",
        question: "Is there a minimum balance to join a game?",
        answer: [
          "Yes. Most games need RM20, and the exact amount is shown on the Sessions page. Joining holds that amount from your wallet as a deposit, and you get it back if you leave early.",
        ],
      },
      {
        id: "topup",
        question: "How do I top up my wallet?",
        answer: [
          "Submit a top-up request in the Wallet tab and make the bank transfer. Once an admin checks and approves it, the credit is added to your wallet.",
        ],
      },
      {
        id: "charged",
        question: "When and how am I charged?",
        answer: [
          "After the game ends, the host finalizes the session. The court and shuttle costs are split between everyone who played, and your share is taken from your deposit, any extra will be refunded to your wallet.",
        ],
      },
      {
        id: "negative",
        question: "What if my balance goes below zero?",
        answer: [
          "If your share is more than your deposit, your wallet can show a negative balance. Top up to cover it, because you can't join another game until your balance is back above the deposit.",
        ],
      },
    ],
  },
  {
    title: "Guests (+1s)",
    items: [
      {
        id: "guests",
        question: "Can I bring a friend who doesn't have an account?",
        answer: [
          "Yes. On the session page, tap “Bring a friend” and add their name. You can bring up to 5 guests per session. A guest takes a normal seat and plays like anyone else.",
        ],
      },
      {
        id: "guests-deposit",
        question: "How much deposit do I need for guests?",
        answer: [
          "Each guest needs the same deposit as you, which is RM20 for most games. For example, you + 1 guest needs RM40 in your wallet. You pay for your guests, since they don't have a wallet of their own.",
        ],
      },
      {
        id: "guests-remove",
        question: "What if I remove a guest, or I can't come?",
        answer: [
          "Removing a guest follows the same cancellation rules as below. If you can't make it, your guests stay in and you still pay for them.",
        ],
      },
    ],
  },
  {
    title: "Cancellations",
    items: [
      {
        id: "deadline",
        question: "What's the cancellation deadline?",
        answer: [
          "Leave at least 24 hours before the game starts and your deposit is refunded instantly. If anyone is on the waiting list, the next person takes your spot.",
        ],
      },
      {
        id: "late-cancel",
        question: "What if I leave within 24 hours of the game?",
        answer: [
          "Tap Leave and your request goes to the host or an admin. You keep your spot until they decide.",
          "If they approve, your deposit is refunded. If they decline, you stay in the game and pay your full share, and you can't ask again for that game.",
          "You can withdraw your request any time before they decide.",
        ],
      },
    ],
  },
];
