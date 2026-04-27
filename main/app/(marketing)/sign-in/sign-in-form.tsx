"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { getOAuthAuthorizeUrl, webApi, WebApiError } from "@/lib/web-api";

type SignInValues = {
  email: string;
  password: string;
};

type SignInErrors = Partial<Record<keyof SignInValues, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignIn(values: SignInValues) {
  const errors: SignInErrors = {};

  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  }

  return errors;
}

function getFieldError(name: keyof SignInValues, value: string) {
  return validateSignIn({
    email: name === "email" ? value : "user@example.com",
    password: name === "password" ? value : "password123",
  })[name];
}

function removeFieldError(errors: SignInErrors, name: keyof SignInValues) {
  const nextErrors = { ...errors };
  delete nextErrors[name];
  return nextErrors;
}

function getInputClassName(hasError: boolean) {
  return `min-h-[46px] w-full rounded-none border bg-[#f7f5f2] px-4 text-[12px] text-black placeholder:text-[#8b857a] focus:outline-2 focus:outline-[#c8bfaed9] focus:outline-offset-2 ${
    hasError ? "border-[#7d2f2f]" : "border-[#9f988c]"
  }`;
}

function getPasswordFieldClassName(hasError: boolean) {
  return `flex min-h-[46px] items-center rounded-none border bg-[#f7f5f2] focus-within:outline-2 focus-within:outline-[#c8bfaed9] focus-within:outline-offset-2 ${
    hasError ? "border-[#7d2f2f]" : "border-[#9f988c]"
  }`;
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="text-[10px] leading-[1.5] text-[#7d2f2f] sm:text-[11px]">
      {message}
    </p>
  );
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

export function SignInForm({ returnTo = "/settings/usage" }: { returnTo?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState<SignInValues>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<SignInErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateSignIn(values);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setGlobalError(null);
      return;
    }

    setErrors({});
    setGlobalError(null);

    startTransition(async () => {
      try {
        const response = await webApi.signIn({
          email: values.email.trim(),
          password: values.password,
        });

        router.push(returnTo || response.redirectTo || "/settings/usage");
        router.refresh();
      } catch (error) {
        if (error instanceof WebApiError) {
          setErrors({
            email: error.getFieldMessage("email"),
            password: error.getFieldMessage("password"),
          });
          setGlobalError(error.message);
          return;
        }

        setGlobalError("Unable to sign in. Try again.");
      }
    });
  };

  const handleFieldChange = (name: keyof SignInValues, value: string) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const nextError = getFieldError(name, value);
      return nextError ? { ...current, [name]: nextError } : removeFieldError(current, name);
    });
  };

  const handleFieldBlur = (name: keyof SignInValues) => {
    const nextError = getFieldError(name, values[name]);

    setErrors((current) => {
      return nextError ? { ...current, [name]: nextError } : removeFieldError(current, name);
    });
  };

  const emailError = errors.email;
  const passwordError = errors.password;

  return (
    <>
      <form className="mt-6 space-y-4 sm:mt-7" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <label htmlFor="email" className="block text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={(event) => handleFieldChange("email", event.target.value)}
            onBlur={() => handleFieldBlur("email")}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "sign-in-email-error" : undefined}
            className={getInputClassName(Boolean(emailError))}
          />
          {emailError ? <FieldError id="sign-in-email-error" message={emailError} /> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
            Password
          </label>
          <div className={getPasswordFieldClassName(Boolean(passwordError))}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={values.password}
              onChange={(event) => handleFieldChange("password", event.target.value)}
              onBlur={() => handleFieldBlur("password")}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "sign-in-password-error" : undefined}
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
          {passwordError ? <FieldError id="sign-in-password-error" message={passwordError} /> : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-[46px] w-full items-center justify-center border border-black bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white sm:text-[9px]"
        >
          {isPending ? "Signing in" : "Continue"}
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
          window.location.href = getOAuthAuthorizeUrl("google", "sign-in", returnTo);
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
        <span>Don&apos;t have an account? </span>
        <Link href="/sign-up" className="text-black underline underline-offset-4">
          Sign up
        </Link>
      </div>
    </>
  );
}
