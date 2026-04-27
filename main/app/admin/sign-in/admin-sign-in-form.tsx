"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { adminCopy } from "@/content/admin";
import { webApi, WebApiError } from "@/lib/web-api";

type SignInValues = {
  email: string;
  password: string;
};

type SignInErrors = Partial<Record<keyof SignInValues, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignIn(values: SignInValues) {
  const errors: SignInErrors = {};
  if (!values.email.trim()) {
    errors.email = "Email admin wajib diisi.";
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = "Masukkan email admin yang valid.";
  }
  if (!values.password) errors.password = "Password admin wajib diisi.";
  return errors;
}

function safeReturnTo(value: string | null) {
  return value?.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export function AdminSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = useState<SignInValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<SignInErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
        const response = await webApi.adminSignIn({ email: values.email.trim(), password: values.password });
        router.push(safeReturnTo(searchParams.get("returnTo") || response.redirectTo));
        router.refresh();
      } catch (error) {
        if (error instanceof WebApiError) {
          setGlobalError(error.message || adminCopy.invalidLogin);
          return;
        }
        setGlobalError(adminCopy.invalidLogin);
      }
    });
  };

  return (
    <form className="mt-6 space-y-4 sm:mt-7" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label htmlFor="admin-email" className="block text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
          Admin email
        </label>
        <input
          id="admin-email"
          type="email"
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          className="min-h-[46px] w-full border border-[#9f988c] bg-[#f7f5f2] px-4 text-[12px] text-black placeholder:text-[#8b857a]"
          placeholder="admin@dwipa.my.id"
        />
        {errors.email ? <p className="text-[10px] text-[#7d2f2f]">{errors.email}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-password" className="block text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
          Password
        </label>
        <div className="flex min-h-[46px] items-center border border-[#9f988c] bg-[#f7f5f2]">
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            className="h-full w-full border-0 bg-transparent px-4 text-[12px] text-black outline-none placeholder:text-[#8b857a]"
            placeholder="Enter admin password"
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setShowPassword((value) => !value)}
            className="mr-2 flex h-8 min-w-8 items-center justify-center text-[9px] uppercase tracking-[0.12em] text-[#6e6a63]"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {errors.password ? <p className="text-[10px] text-[#7d2f2f]">{errors.password}</p> : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex min-h-[46px] w-full items-center justify-center border border-black bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white disabled:opacity-60 sm:text-[9px]"
      >
        {isPending ? "Signing in" : "Continue"}
      </button>

      {globalError ? <p className="text-[10px] leading-[1.6] text-[#7d2f2f] sm:text-[11px]">{globalError}</p> : null}

      <div className="border-t border-[#ddd7cf] pt-5 text-center text-[8px] uppercase tracking-[0.14em] text-[#6e6a63] sm:text-[9px]">
        <Link href="/" className="text-black underline underline-offset-4">
          Back to Dwipa
        </Link>
      </div>
    </form>
  );
}
