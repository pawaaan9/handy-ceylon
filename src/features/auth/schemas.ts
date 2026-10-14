import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "./constants";

/** Sri Lankan mobile numbers: 07XXXXXXXX or +947XXXXXXXX, normalised to E.164. */
export const sriLankaMobileSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(?:\+94|0094|94|0)7\d{8}$/, "Enter a valid Sri Lankan mobile number, e.g. 077 123 4567"),
  )
  .transform((value) => `+94${value.slice(-9)}`);

/**
 * Any Sri Lankan number — mobile (07X) or landline (0XX) — 9 digits after the
 * leading 0, normalised to E.164.
 */
export const sriLankaPhoneSchema = z
  .string()
  .trim()
  .min(1, "Enter a contact number")
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(?:\+94|0094|94|0)[1-9]\d{8}$/, "Enter a valid Sri Lankan phone number, e.g. 077 123 4567"),
  )
  .transform((value) => `+94${value.slice(-9)}`);

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .pipe(z.email("Enter a valid email address"))
  .transform((value) => value.toLowerCase());

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(80, "Name must be 80 characters or fewer")
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, "Use letters, spaces, apostrophes or hyphens only");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");

const acceptTermsSchema = z
  .boolean()
  .refine((v) => v === true, "You must accept the Terms of Service and Privacy Policy");

export const signUpSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phoneNumber: sriLankaMobileSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptTerms: acceptTermsSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignUpFormValues = z.input<typeof signUpSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});
export type LoginFormValues = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordFormValues = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.input<typeof resetPasswordSchema>;

/**
 * Finishing an Auth account that has no Handy Ceylon profile yet (Google or
 * mobile sign-in, or an interrupted sign-up). The mobile number is only used
 * when Firebase Auth doesn't already hold a verified one.
 */
export const completeProfileSchema = z.object({
  fullName: fullNameSchema,
  phoneNumber: z.union([z.literal(""), sriLankaMobileSchema]).optional(),
  acceptTerms: acceptTermsSchema,
});
export type CompleteProfileFormValues = z.input<typeof completeProfileSchema>;
export type CompleteProfileInput = z.output<typeof completeProfileSchema>;

/** Linking an email + password to a mobile-only account. */
export const linkEmailSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type LinkEmailFormValues = z.input<typeof linkEmailSchema>;

/** Sri Lankan mobile → E.164, for phone sign-in. */
export const phoneSignInSchema = z.object({
  // The +94 prefix is shown beside the input, so "77 123 4567" is accepted too.
  phoneNumber: z
    .string()
    .transform((v) => {
      const digits = v.replace(/[\s()-]/g, "");
      return /^7\d{8}$/.test(digits) ? `0${digits}` : digits;
    })
    .pipe(sriLankaMobileSchema),
});
export type PhoneSignInFormValues = z.input<typeof phoneSignInSchema>;

export const otpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the SMS"),
});
export type OtpFormValues = z.input<typeof otpSchema>;
