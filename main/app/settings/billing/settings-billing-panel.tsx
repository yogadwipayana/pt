"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { billingSection, billingSummaryCards } from "@/content/account";
import { type BillingOverviewResponse, type ManualPayment, type SubscriptionSummary, webApi, WebApiError } from "@/lib/web-api";

type SubscriptionState = "active" | "renew_off";
type FlashState = "renewed" | "canceled" | "add_funds" | "pro_payment" | null;
type CheckoutIntent = "pro" | "add-funds" | null;

type SettingsBillingPanelProps = {
  initialBilling: BillingOverviewResponse | null;
  initialCheckoutIntent?: CheckoutIntent;
};

const WHATSAPP_CONFIRM_URL = "https://wa.me/6287889640714";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSubscriptionDetail(subscription: SubscriptionSummary | null) {
  if (!subscription) {
    return "No active renewal window";
  }

  if (!subscription.renewsAt || !subscription.price) {
    return "Balance available now";
  }

  const renewsAt = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(subscription.renewsAt));

  return `Renews on ${renewsAt} - ${formatCurrency(subscription.price.amount, subscription.price.currency)} / ${subscription.price.interval}`;
}

function getPaymentPurposeLabel(payment: ManualPayment) {
  return payment.purpose === "upgrade_plan" ? "Dwipa Pro" : "Add funds";
}

function buildWhatsAppUrl(payment: ManualPayment) {
  const message = [
    "Halo Dwipa, saya sudah membayar.",
    `Reference: ${payment.referenceCode}`,
    `Purpose: ${getPaymentPurposeLabel(payment)}`,
    `Amount: ${formatCurrency(payment.amountMinor, payment.currency)}`,
    "Mohon konfirmasi pembayaran ini.",
  ].join("\n");

  return `${WHATSAPP_CONFIRM_URL}?text=${encodeURIComponent(message)}`;
}

function shouldShowPaymentDestination(payment: ManualPayment) {
  if (!payment.destination) return false;
  const provider = payment.destination.provider.trim().toLowerCase();
  return provider !== "gopay" && provider !== "qris";
}

function PaymentInstruction({ payment, onViewFullQris }: { payment: ManualPayment; onViewFullQris: () => void }) {
  const paymentDestination = shouldShowPaymentDestination(payment) ? payment.destination : null;

  return (
    <div className="grid gap-4 border border-[#b8b1a5] bg-[#f7f3eb] p-4 sm:grid-cols-[minmax(0,1fr)_190px]">
      <div>
        <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
          {billingSection.paymentReferenceLabel} {payment.referenceCode}
        </p>
        <p className="mt-2 text-[22px] leading-none tracking-[-0.04em] text-black">
          {formatCurrency(payment.amountMinor, payment.currency)}
        </p>
        <p className="mt-2 text-[10px] leading-[1.55] text-[#6f695f] sm:text-[11px]">
          {billingSection.paymentConfirmDescription}
        </p>
        {paymentDestination ? (
          <div className="mt-4 grid gap-1 text-[10px] leading-[1.55] text-[#6f695f] sm:text-[11px]">
            <p>{paymentDestination.displayName}</p>
            <p>{paymentDestination.accountNumber}</p>
            {paymentDestination.accountHolderName ? <p>{paymentDestination.accountHolderName}</p> : null}
            {paymentDestination.instructions ? <p>{paymentDestination.instructions}</p> : null}
          </div>
        ) : null}
        <a
          href={buildWhatsAppUrl(payment)}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex min-h-[44px] w-full items-center justify-center bg-black px-5 text-[8px] uppercase tracking-[0.16em] text-white sm:w-fit sm:text-[9px]"
        >
          {billingSection.paymentConfirmLabel}
        </a>
      </div>

      <div className="border border-[#d7d0c4] bg-[#fbfaf7] p-2">
        <p className="mb-2 text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
          {billingSection.paymentQrLabel}
        </p>
        <Image
          src="/qris.jpg"
          alt="QRIS Dwipa payment code"
          width={1080}
          height={1344}
          className="h-auto w-full"
          priority
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onViewFullQris}
            className="flex min-h-[36px] items-center justify-center border border-[#b8b1a5] px-3 text-[8px] uppercase tracking-[0.14em] text-[#111111] sm:text-[9px]"
          >
            Full
          </button>
          <a
            href="/qris.jpg"
            download="dwipa-qris.jpg"
            className="flex min-h-[36px] items-center justify-center bg-black px-3 text-[8px] uppercase tracking-[0.14em] text-white sm:text-[9px]"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

export function SettingsBillingPanel({ initialBilling, initialCheckoutIntent = null }: SettingsBillingPanelProps) {
  const [subscriptionCard, creditsCard] = billingSummaryCards;
  const [isManagePlanOpen, setIsManagePlanOpen] = useState(initialCheckoutIntent === "pro");
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(initialCheckoutIntent === "add-funds");
  const [isQrisPreviewOpen, setIsQrisPreviewOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [createdPayment, setCreatedPayment] = useState<ManualPayment | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isCreatingProPayment, setIsCreatingProPayment] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(initialBilling?.subscription ?? null);
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(
    initialBilling?.subscription?.status === "renew_off" ? "renew_off" : "active",
  );
  const [creditBalance] = useState(initialBilling?.creditBalance.displayValue ?? creditsCard.title);
  const [flashState, setFlashState] = useState<FlashState>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isManagePlanOpen && !isAddFundsOpen && !isQrisPreviewOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsManagePlanOpen(false);
        setIsAddFundsOpen(false);
        setIsQrisPreviewOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isManagePlanOpen, isAddFundsOpen, isQrisPreviewOpen]);

  useEffect(() => {
    if (!flashState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFlashState(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [flashState]);

  const openManagePlan = () => {
    setErrorMessage(null);
    setCreatedPayment(null);
    setIsManagePlanOpen(true);
  };

  const openAddFunds = () => {
    setErrorMessage(null);
    setCreatedPayment(null);
    setAddFundsAmount("");
    setIsAddFundsOpen(true);
  };

  const handleRenew = () => {
    setErrorMessage(null);
    void webApi
      .updateSubscription({ action: "renew" })
      .then((nextSubscription) => {
        setSubscription(nextSubscription);
        setSubscriptionState("active");
        setFlashState("renewed");
        setIsManagePlanOpen(false);
      })
      .catch((error) => {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to renew this subscription.");
      });
  };

  const handleCancelRenewal = () => {
    setErrorMessage(null);
    void webApi
      .updateSubscription({ action: "cancel" })
      .then((nextSubscription) => {
        setSubscription(nextSubscription);
        setSubscriptionState("renew_off");
        setFlashState("canceled");
        setIsManagePlanOpen(false);
      })
      .catch((error) => {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to cancel this subscription.");
      });
  };

  const handleCreateProPayment = () => {
    setErrorMessage(null);
    setIsCreatingProPayment(true);
    void webApi
      .createManualPaymentIntent({ purpose: "upgrade_plan", planSlug: "pro" })
      .then((response) => {
        setCreatedPayment(response.payment);
        setFlashState("pro_payment");
      })
      .catch((error) => {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to create this Pro payment.");
      })
      .finally(() => {
        setIsCreatingProPayment(false);
      });
  };

  const handleCreateAddFundsPayment = () => {
    const amount = Number(addFundsAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setErrorMessage(billingSection.addFundsErrorAmount);
      return;
    }

    setErrorMessage(null);
    setIsCreatingPayment(true);
    void webApi
      .createManualPaymentIntent({ purpose: "add_funds", amountMinor: amount })
      .then((response) => {
        setCreatedPayment(response.payment);
        setFlashState("add_funds");
      })
      .catch((error) => {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to create this manual payment.");
      })
      .finally(() => {
        setIsCreatingPayment(false);
      });
  };

  const subscriptionBadgeLabel =
    !subscription
      ? "Free"
      : subscriptionState === "active"
      ? billingSection.statusActive
      : billingSection.statusRenewOff;
  const isFreePlanUser = !subscription || subscription.planSlug === "free";
  const subscriptionTitle = subscription?.planName || (isFreePlanUser ? "Free" : subscriptionCard.title);
  const subscriptionDetail = isFreePlanUser
    ? "No active renewal window"
    : formatSubscriptionDetail(subscription);
  const managePlanLabel = isFreePlanUser ? "Upgrade plan" : subscriptionCard.actionLabel;

  const flashMessage =
    flashState === "renewed"
      ? billingSection.actionRenewed
      : flashState === "canceled"
        ? billingSection.actionCanceled
        : flashState === "add_funds"
          ? billingSection.addFundsCreated
          : flashState === "pro_payment"
            ? billingSection.proPaymentCreated
            : null;

  return (
    <section>
      <div className="border-b border-[#cfc7bb] pb-5">
        <p className="text-[8px] uppercase tracking-[0.16em] text-[#8a847a] sm:text-[9px]">
          Settings
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[28px] leading-[0.96] tracking-[-0.05em] text-black sm:text-[36px]">
              {billingSection.title}
            </h2>
            <p className="mt-2 max-w-[480px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
              {billingSection.description}
            </p>
          </div>
          <p className="text-[8px] uppercase tracking-[0.14em] text-[#8a847a] sm:text-[9px]">
            Workspace billing overview
          </p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-3 sm:mt-7 sm:grid-cols-2 sm:gap-4">
        <article className="flex flex-col justify-between border border-[#bdb4a6] bg-[#faf7f1] p-4 sm:p-5">
          <div>
            <div className="flex items-start justify-between gap-4">
              <p className="text-[8px] uppercase tracking-[0.16em] text-[#6f695f] sm:text-[9px]">
                {subscriptionCard.eyebrow}
              </p>
              <span className="text-[8px] uppercase tracking-[0.14em] text-[#8a847a] sm:text-[9px]">
                {subscriptionBadgeLabel}
              </span>
            </div>
            <h3 className="mt-4 text-[24px] leading-[0.95] tracking-[-0.05em] text-black sm:text-[30px]">
              {subscriptionTitle}
            </h3>
            {subscriptionCard.description ? (
              <p className="mt-3 max-w-[260px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                {subscriptionCard.description}
              </p>
            ) : null}
            {flashMessage ? (
              <p className="mt-4 max-w-[260px] text-[10px] leading-[1.55] text-[#6f695f] sm:text-[11px]">
                {flashMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex items-end justify-between gap-4 border-t border-[#d7d0c4] pt-4">
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#6f695f] sm:text-[9px]">
              {subscriptionDetail}
            </p>
            <button
              type="button"
              onClick={openManagePlan}
              className="min-h-[36px] border border-black px-3 text-[8px] uppercase tracking-[0.14em] text-black sm:px-4 sm:text-[9px]"
            >
              {managePlanLabel}
            </button>
          </div>
        </article>

        <article className="flex flex-col justify-between border border-[#bdb4a6] bg-[#faf7f1] p-4 sm:p-5">
          <div>
            <div className="flex items-start justify-between gap-4">
              <p className="text-[8px] uppercase tracking-[0.16em] text-[#6f695f] sm:text-[9px]">
                {creditsCard.eyebrow}
              </p>
              <span className="text-[8px] uppercase tracking-[0.14em] text-[#8a847a] sm:text-[9px]">
                Active
              </span>
            </div>
            <h3 className="mt-4 text-[24px] leading-[0.95] tracking-[-0.05em] text-black sm:text-[30px]">
              {creditBalance}
            </h3>
            {creditsCard.description ? (
              <p className="mt-3 max-w-[280px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                {creditsCard.description}
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex items-end justify-between gap-4 border-t border-[#d7d0c4] pt-4">
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#6f695f] sm:text-[9px]">
              {creditsCard.detail || "Balance available now"}
            </p>
            <button
              type="button"
              onClick={openAddFunds}
              className="min-h-[36px] border border-black px-3 text-[8px] uppercase tracking-[0.14em] text-black sm:px-4 sm:text-[9px]"
            >
              {creditsCard.actionLabel}
            </button>
          </div>
        </article>
      </div>

      {isManagePlanOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111111]/65 px-4 pb-4 pt-16 sm:items-center sm:p-6"
          onClick={() => setIsManagePlanOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-plan-modal-title"
            className="max-h-[calc(100vh-48px)] w-full max-w-[640px] overflow-y-auto border border-[#b8b1a5] bg-[#fbfaf7] p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
              {billingSection.manageModalEyebrow}
            </p>
            <h3
              id="manage-plan-modal-title"
              className="mt-3 text-[26px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]"
            >
              {createdPayment ? billingSection.addFundsPendingTitle : billingSection.manageModalTitle}
            </h3>
            <p className="mt-2 max-w-[46ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
              {createdPayment ? billingSection.addFundsPendingDescription : billingSection.manageModalDescription}
            </p>

            <div className="mt-5 grid gap-3">
              {errorMessage ? (
                <p className="text-[10px] leading-[1.55] text-[#7a4335] sm:text-[11px]">{errorMessage}</p>
              ) : null}

              {createdPayment ? (
                <PaymentInstruction payment={createdPayment} onViewFullQris={() => setIsQrisPreviewOpen(true)} />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCreateProPayment}
                    disabled={isCreatingProPayment}
                    className="border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-4 text-left disabled:opacity-60"
                  >
                    <span className="block text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                      {billingSection.proPaymentOptionLabel}
                    </span>
                    <span className="mt-2 block max-w-[44ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                      {isCreatingProPayment ? billingSection.proPaymentCreatingLabel : billingSection.proPaymentOptionDescription}
                    </span>
                  </button>

                  {!isFreePlanUser ? (
                    <>
                      <button
                        type="button"
                        onClick={handleRenew}
                        className="border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-4 text-left"
                      >
                        <span className="block text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                          {billingSection.renewOptionLabel}
                        </span>
                        <span className="mt-2 block max-w-[44ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                          {billingSection.renewOptionDescription}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelRenewal}
                        className="border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-4 text-left"
                      >
                        <span className="block text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                          {billingSection.cancelOptionLabel}
                        </span>
                        <span className="mt-2 block max-w-[44ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                          {billingSection.cancelOptionDescription}
                        </span>
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManagePlanOpen(false)}
                className="flex min-h-[44px] items-center justify-center border border-[#b8b1a5] px-5 text-[8px] uppercase tracking-[0.16em] text-[#5f5a53] sm:text-[9px]"
              >
                {billingSection.closeLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddFundsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111111]/65 px-4 pb-4 pt-16 sm:items-center sm:p-6"
          onClick={() => setIsAddFundsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-funds-modal-title"
            className="max-h-[calc(100vh-48px)] w-full max-w-[640px] overflow-y-auto border border-[#b8b1a5] bg-[#fbfaf7] p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
              {billingSection.addFundsModalEyebrow}
            </p>
            <h3
              id="add-funds-modal-title"
              className="mt-3 text-[26px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]"
            >
              {createdPayment ? billingSection.addFundsPendingTitle : billingSection.addFundsModalTitle}
            </h3>
            <p className="mt-2 max-w-[46ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
              {createdPayment ? billingSection.addFundsPendingDescription : billingSection.addFundsModalDescription}
            </p>

            <div className="mt-5 grid gap-3">
              {errorMessage ? (
                <p className="text-[10px] leading-[1.55] text-[#7a4335] sm:text-[11px]">{errorMessage}</p>
              ) : null}

              {createdPayment ? (
                <PaymentInstruction payment={createdPayment} onViewFullQris={() => setIsQrisPreviewOpen(true)} />
              ) : (
                <label className="grid gap-2 text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                  {billingSection.addFundsAmountLabel}
                  <input
                    value={addFundsAmount}
                    onChange={(event) => setAddFundsAmount(event.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder={billingSection.addFundsAmountPlaceholder}
                    className="min-h-[44px] appearance-none border border-[#b8b1a5] bg-[#fbfaf7] px-3 text-[12px] tracking-normal text-black outline-none"
                  />
                </label>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsAddFundsOpen(false)}
                className="flex min-h-[44px] items-center justify-center border border-[#b8b1a5] px-5 text-[8px] uppercase tracking-[0.16em] text-[#5f5a53] sm:text-[9px]"
              >
                {billingSection.closeLabel}
              </button>
              {!createdPayment ? (
                <button
                  type="button"
                  onClick={handleCreateAddFundsPayment}
                  disabled={isCreatingPayment}
                  className="flex min-h-[44px] items-center justify-center bg-black px-5 text-[8px] uppercase tracking-[0.16em] text-white disabled:opacity-60 sm:text-[9px]"
                >
                  {isCreatingPayment ? "Creating" : billingSection.addFundsSubmitLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isQrisPreviewOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111111]/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Full QRIS payment code"
          onClick={() => setIsQrisPreviewOpen(false)}
        >
          <Image
            src="/qris.jpg"
            alt="QRIS Dwipa payment code"
            width={1080}
            height={1344}
            className="max-h-[calc(100vh-32px)] w-auto max-w-full"
            priority
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}
