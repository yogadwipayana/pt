type SettingsTab = {
  label: string;
  href: string;
};

type UsageMeter = {
  label: string;
  description: string;
  value: string;
  total: string;
  progress: number;
  countdown?: string;
};

type ApiKeyUsageMode = "subscription" | "payg" | "both";

export type ApiKeyCard = {
  id: string;
  label: string;
  maskedKey: string;
  addedLabel: string;
  usageMode?: ApiKeyUsageMode;
  copyValue?: string;
};

type BillingSummaryCard = {
  eyebrow: string;
  title: string;
  description?: string;
  detail?: string;
  actionLabel: string;
};

export const settingsTabs: SettingsTab[] = [
  { label: "Usage", href: "/settings/usage" },
  { label: "Logs", href: "/settings/logs" },
  { label: "Keys", href: "/settings/keys" },
  { label: "Billing", href: "/settings/billing" },
];

export const profileSummary = {
  name: "yogadwipayana2006",
  email: "yogadwipayana2006@gmail.com",
};

export const usageSection = {
  title: "Usage",
  description: "Monitor your usage plan consumption",
  upgradeLabel: "Upgrade plan",
};

export const usageMeters: UsageMeter[] = [
  {
    label: "Credit balance",
    description: "Credits added through approved manual payments.",
    value: "$0",
    total: "$0",
    progress: 0,
  },
];

export const logsSection = {
  title: "Logs",
  description: "Review recent API requests, token usage, and charged credit.",
  emptyTitle: "No requests yet",
  emptyDescription: "Requests made with a Dwipa API key will appear here after they complete.",
};

export const apiKeysSection = {
  title: "API keys",
  description: "API keys can be used to access models",
  addLabel: "+ Add API Key",
  modalEyebrow: "Create key",
  modalTitle: "Create a new API key",
  modalDescription:
    "Add a clear name so you can tell where this key is being used before generating the secret.",
  nameLabel: "Key name",
  namePlaceholder: "Production Search",
  usageModeLabel: "Plan access",
  usageModeDescription: "Choose which billing path this key can use.",
  usageModeOptions: [
    {
      value: "both",
      label: "Subscription + PayG",
      description: "Use both",
    },
    {
      value: "subscription",
      label: "Subscription",
      description: "Use subscription credits only",
    },
    {
      value: "payg",
      label: "Pay as you go",
      description: "Use credit balance only",
    },
  ] satisfies { value: ApiKeyUsageMode; label: string; description: string }[],
  usageModeCardLabel: "Plan access",
  editLabel: "Edit",
  editModalEyebrow: "Edit key",
  editModalTitle: "Update plan access",
  editModalDescription: "Change which billing path this key can use for future requests.",
  saveLabel: "Save changes",
  updateError: "Unable to update this key.",
  cancelLabel: "Cancel",
  createLabel: "Create key",
  doneLabel: "Done",
  revealTitle: "Copy your new API key",
  revealDescription:
    "This value is only shown once in this session. Copy it now and store it somewhere secure.",
  copyLabel: "Copy",
  copiedLabel: "Copied",
  deleteLabel: "Delete",
  deleteModalEyebrow: "Delete key",
  deleteModalTitle: "Delete API key?",
  deleteModalDescription:
    "Remove this key from your workspace. Any app still using it will stop being able to access models.",
  deleteModalWarning: "This action cannot be undone.",
  confirmDeleteLabel: "Delete key",
  createErrorEmpty: "Enter a name for the key.",
  createErrorDuplicate: "Use a different name for this key.",
  justAddedLabel: "Added just now",
};

export const apiKeyCards: ApiKeyCard[] = [
  {
    id: "key_01",
    label: "Default",
    maskedKey: "tba87265c8a547daad97b6e93b78cf1...",
    addedLabel: "Added 2 days ago",
    usageMode: "both",
    copyValue: "dw_tba87265c8a547daad97b6e93b78cf145d0e1f2",
  },
  {
    id: "key_02",
    label: "Production Search",
    maskedKey: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...",
    addedLabel: "Added 1 month ago",
    usageMode: "both",
    copyValue: "dw_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p64f7a9c2d",
  },
];

export const billingSection = {
  title: "Billing",
  description: "Manage plan renewals, credit balance",
  manageModalEyebrow: "Manage plan",
  manageModalTitle: "Manage Dwipa Pro",
  manageModalDescription:
    "Choose whether this workspace should keep renewing Dwipa Pro or stop renewal after the current billing period.",
  renewOptionLabel: "Renew subscription",
  renewOptionDescription:
    "Keep Dwipa Pro active and renew the workspace on the next billing date.",
  cancelOptionLabel: "Cancel subscription",
  cancelOptionDescription:
    "Turn off auto-renewal while keeping access until the current billing period ends.",
  closeLabel: "Close",
  statusActive: "Active",
  statusRenewOff: "Renewal off",
  actionRenewed: "Subscription renewal confirmed.",
  actionCanceled: "Subscription will end after the current billing period.",
  addFundsModalEyebrow: "Add funds",
  addFundsModalTitle: "Add credit balance",
  addFundsModalDescription:
    "Enter the amount you want to add. We will create a manual payment reference for approval.",
  addFundsAmountLabel: "Amount in IDR",
  addFundsAmountPlaceholder: "50000",
  addFundsSubmitLabel: "Create payment reference",
  addFundsPendingTitle: "Manual payment created",
  addFundsPendingDescription:
    "Scan the QRIS code, then confirm the transfer through WhatsApp for manual approval.",
  addFundsErrorAmount: "Enter an amount greater than 0.",
  addFundsCreated: "Manual payment created. Credits will update after approval.",
  proPaymentOptionLabel: "Pay Dwipa Pro",
  proPaymentOptionDescription:
    "Create a Pro payment reference, scan the QRIS code, then confirm the transfer through WhatsApp.",
  proPaymentCreatingLabel: "Creating",
  proPaymentCreated: "Pro payment created. Access updates after manual approval.",
  paymentQrLabel: "QRIS payment",
  paymentReferenceLabel: "Reference",
  paymentConfirmLabel: "Confirm on WhatsApp",
  paymentConfirmDescription: "Send the reference code and transfer proof to WhatsApp after payment.",
};

export const billingSummaryCards: BillingSummaryCard[] = [
  {
    eyebrow: "Current subscription",
    title: "Dwipa Pro",
    detail: "Renews on 14 Oct 2024 - Rp 50.000 / month",
    actionLabel: "Manage plan",
  },
  {
    eyebrow: "Balance",
    title: "$0",
    detail: "Pay as you go balance available now",
    actionLabel: "Add funds",
  },
];
