/**
 * Client-side Authentication & Security Validators.
 * Guarantees standard input conformance before dispatching API requests.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  score: number; // 0 to 4
}

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required.", score: 0 };
  }

  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long.", score: 1 };
  }

  let score = 1;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  return { valid: true, score };
}

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  acceptedNda: boolean;
  role?: string;
}

export interface ValidationSummary {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateRegistrationForm(input: RegistrationInput): ValidationSummary {
  const errors: Record<string, string> = {};

  const cleanName = (input.name || "").trim();
  if (!cleanName) {
    errors.name = "Full name is required.";
  } else if (cleanName.length < 2) {
    errors.name = "Full name must be at least 2 characters.";
  }

  if (!input.email || !isValidEmail(input.email)) {
    errors.email = "Please provide a valid corporate email address.";
  }

  const pwdRes = validatePassword(input.password);
  if (!pwdRes.valid) {
    errors.password = pwdRes.error || "Password does not meet minimum security requirements.";
  }

  if (!input.acceptedNda) {
    errors.acceptedNda = "You must agree to the confidentiality and NDA terms to register.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validatePasswordReset(password: string, confirmPassword: string): ValidationSummary {
  const errors: Record<string, string> = {};

  const pwdRes = validatePassword(password);
  if (!pwdRes.valid) {
    errors.password = pwdRes.error || "Password does not meet minimum requirements.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Confirmation password is required.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
