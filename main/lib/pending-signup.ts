export const pendingSignupEmailStorageKey = "dwipa_pending_signup_email";
export const pendingSignupChallengeStorageKey = "dwipa_pending_signup_challenge";

export type PendingSignupChallenge = {
  challengeId: string;
  email: string;
  maskedDestination: string;
  expiresAt: string;
  debugOtp?: string;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const normalizePendingSignupEmail = (value: string | null | undefined) => {
  const normalized = value?.trim();

  if (!normalized || !isValidEmail(normalized)) {
    return null;
  }

  return normalized;
};

export function readPendingSignupChallenge() {
  const rawValue = window.sessionStorage.getItem(pendingSignupChallengeStorageKey);

  if (!rawValue) {
    const email = normalizePendingSignupEmail(window.sessionStorage.getItem(pendingSignupEmailStorageKey));
    return email ? { challengeId: "", email, maskedDestination: email, expiresAt: "" } : null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PendingSignupChallenge;
    const email = normalizePendingSignupEmail(parsed.email);

    if (!parsed.challengeId || !email) {
      return null;
    }

    return {
      challengeId: parsed.challengeId,
      email,
      maskedDestination: parsed.maskedDestination || email,
      expiresAt: parsed.expiresAt || "",
      debugOtp: typeof parsed.debugOtp === "string" ? parsed.debugOtp : undefined,
    };
  } catch {
    return null;
  }
}

export function writePendingSignupChallenge(challenge: PendingSignupChallenge) {
  window.sessionStorage.setItem(pendingSignupEmailStorageKey, challenge.email);
  window.sessionStorage.setItem(pendingSignupChallengeStorageKey, JSON.stringify(challenge));
}

export function clearPendingSignupChallenge() {
  window.sessionStorage.removeItem(pendingSignupEmailStorageKey);
  window.sessionStorage.removeItem(pendingSignupChallengeStorageKey);
}
