"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { writePendingSignupChallenge } from "@/lib/pending-signup";
import { getOAuthAuthorizeUrl, webApi, WebApiError } from "@/lib/web-api";

type SignUpValues = {
  fullName: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
};

type SignUpErrors = Partial<Record<keyof SignUpValues, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function removeFieldError(errors: SignUpErrors, name: keyof SignUpValues) {
  const nextErrors = { ...errors };
  delete nextErrors[name];
  return nextErrors;
}

function validateSignUp(values: SignUpValues) {
  const errors: SignUpErrors = {};

  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!values.agreedToTerms) {
    errors.agreedToTerms = "You must agree to the Terms and Privacy Policy.";
  }

  return errors;
}

function getFieldError(name: keyof SignUpValues, value: string | boolean) {
  return validateSignUp({
    fullName: name === "fullName" ? (value as string) : "Dwipa User",
    email: name === "email" ? (value as string) : "user@example.com",
    password: name === "password" ? (value as string) : "password123",
    agreedToTerms: name === "agreedToTerms" ? (value as boolean) : true,
  })[name];
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.3A11.4 11.4 0 0 1 12 6c6.5 0 10 6 10 6a18.6 18.6 0 0 1-4.2 4.7" />
      <path d="M6.2 6.2A18.2 18.2 0 0 0 2 12s3.5 6 10 6c1.8 0 3.4-.4 4.8-1.1" />
      <path d="M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9" />
    </svg>
  );
}

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState<SignUpValues>({
    fullName: "",
    email: "",
    password: "",
    agreedToTerms: false,
  });
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateSignUp(values);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setGlobalError(null);
      return;
    }

    setErrors({});
    setGlobalError(null);

    startTransition(async () => {
      try {
        const challenge = await webApi.signUp({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
        });

        writePendingSignupChallenge({
          challengeId: challenge.challengeId,
          email: challenge.email,
          maskedDestination: challenge.maskedDestination,
          expiresAt: challenge.expiresAt,
          debugOtp: challenge.debugOtp,
        });
        router.push(challenge.redirectTo || "/otp");
      } catch (error) {
        if (error instanceof WebApiError) {
          setErrors({
            fullName: error.getFieldMessage("fullName"),
            email: error.getFieldMessage("email"),
            password: error.getFieldMessage("password"),
          });
          setGlobalError(error.message);
          return;
        }

        setGlobalError("Unable to create your account. Try again.");
      }
    });
  };

  const handleFieldChange = (name: keyof SignUpValues, value: string | boolean) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const nextError = getFieldError(name, value);

      if (!nextError) {
        return removeFieldError(current, name);
      }

      return {
        ...current,
        [name]: nextError,
      };
    });
  };

  const handleFieldBlur = (name: keyof SignUpValues) => {
    const nextError = getFieldError(name, values[name]);

    setErrors((current) => {
      if (!nextError) {
        return removeFieldError(current, name);
      }

      return {
        ...current,
        [name]: nextError,
      };
    });
  };

  const fullNameError = errors.fullName;
  const emailError = errors.email;
  const passwordError = errors.password;
  const inputClassName = `min-h-[46px] w-full rounded-none border bg-[#f7f5f2] px-4 text-[12px] text-black placeholder:text-[#8b857a] focus:outline-2 focus:outline-[#c8bfaed9] focus:outline-offset-2`;
  const passwordFieldClassName = `flex min-h-[46px] items-center rounded-none border bg-[#f7f5f2] focus-within:outline-2 focus-within:outline-[#c8bfaed9] focus-within:outline-offset-2 ${
    passwordError ? "border-[#7d2f2f]" : "border-[#9f988c]"
  }`;

  return (
    <>
      <form className="mt-6 space-y-4 sm:mt-7" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <label htmlFor="full-name" className="block text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
            Full name
          </label>
          <input
            id="full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={values.fullName}
            onChange={(event) => handleFieldChange("fullName", event.target.value)}
            onBlur={() => handleFieldBlur("fullName")}
            aria-invalid={fullNameError ? true : undefined}
            aria-describedby={fullNameError ? "full-name-error" : undefined}
            className={`${inputClassName} ${
              fullNameError ? "border-[#7d2f2f]" : "border-[#9f988c]"
            }`}
          />
          {fullNameError ? (
            <p id="full-name-error" className="text-[10px] leading-[1.5] text-[#7d2f2f] sm:text-[11px]">
              {fullNameError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={(event) => handleFieldChange("email", event.target.value)}
            onBlur={() => handleFieldBlur("email")}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
            className={`${inputClassName} ${
              emailError ? "border-[#7d2f2f]" : "border-[#9f988c]"
            }`}
          />
          {emailError ? (
            <p id="email-error" className="text-[10px] leading-[1.5] text-[#7d2f2f] sm:text-[11px]">
              {emailError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
            Password
          </label>
          <div className={passwordFieldClassName}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              value={values.password}
              onChange={(event) => handleFieldChange("password", event.target.value)}
              onBlur={() => handleFieldBlur("password")}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "password-error" : undefined}
              className="h-full min-h-0 w-full border-0 bg-transparent px-4 py-0 text-[12px] text-black placeholder:text-[#8b857a] outline-none"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setShowPassword((value) => !value)}
              className="mr-2 flex h-8 w-8 items-center justify-center text-[#6e6a63] transition-colors hover:text-black"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {passwordError ? (
            <p id="password-error" className="text-[10px] leading-[1.5] text-[#7d2f2f] sm:text-[11px]">
              {passwordError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="agreedToTerms"
              checked={values.agreedToTerms}
              onChange={(event) => handleFieldChange("agreedToTerms", event.target.checked)}
              aria-invalid={errors.agreedToTerms ? true : undefined}
              aria-describedby={errors.agreedToTerms ? "terms-error" : undefined}
              className="mt-[2px] h-4 w-4 rounded-none border-[#9f988c] accent-black"
            />
            <span className="text-[10px] leading-[1.5] text-[#6e6a63] sm:text-[11px]">
              I agree to the{" "}
              <Link href="/terms" className="text-black underline underline-offset-2">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-black underline underline-offset-2">
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.agreedToTerms ? (
            <p id="terms-error" className="text-[10px] leading-[1.5] text-[#7d2f2f] sm:text-[11px]">
              {errors.agreedToTerms}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-[46px] w-full items-center justify-center border border-black bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white disabled:bg-[#9f988c] disabled:border-[#9f988c] sm:text-[9px]"
        >
          {isPending ? "Preparing OTP" : "Create account"}
        </button>
      </form>

      {globalError ? (
        <p className="mt-3 text-[10px] leading-[1.6] text-[#7d2f2f] sm:text-[11px]">{globalError}</p>
      ) : null}

      <div className="my-5 flex items-center gap-3 sm:my-6">
        <div className="h-px flex-1 bg-[#d8d2c8]" />
        <span className="text-[8px] uppercase tracking-[0.16em] text-[#7a746b] sm:text-[9px]">Or</span>
        <div className="h-px flex-1 bg-[#d8d2c8]" />
      </div>

      <button
        type="button"
        onClick={() => {
          window.location.href = getOAuthAuthorizeUrl("google", "sign-up", "/settings/usage");
        }}
        className="flex min-h-[46px] w-full items-center justify-between border border-[#9f988c] bg-transparent px-4 text-left"
      >
        <span className="flex h-6 w-6 items-center justify-center">
          <Image src="/google.svg" alt="Google" width={16} height={16} className="h-4 w-4" />
        </span>
        <span className="text-[8px] uppercase tracking-[0.16em] text-black sm:text-[9px]">Continue with Google</span>
        <span aria-hidden="true" className="text-[#8b857a]">↗</span>
      </button>

      <div className="mt-6 border-t border-[#ddd7cf] pt-5 text-center text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:mt-7 sm:pt-6 sm:text-[9px]">
        <span>Already have an account? </span>
        <Link href="/sign-in" className="text-black underline underline-offset-4">
          Sign in
        </Link>
      </div>
    </>
  );
}
