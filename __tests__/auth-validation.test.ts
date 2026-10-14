import {
  isValidEmail,
  validatePassword,
  validateRegistrationForm,
  validatePasswordReset,
} from "@/lib/auth-validation";

describe("Client-side Authentication & Security Validators", () => {
  describe("isValidEmail", () => {
    it("accepts valid corporate and standard email addresses", () => {
      expect(isValidEmail("engineer@chevron.com")).toBe(true);
      expect(isValidEmail("qa.analyst@wellqc.io")).toBe(true);
      expect(isValidEmail("user_123@subsurface.org")).toBe(true);
    });

    it("rejects malformed email formats", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail("user@domain")).toBe(false);
      expect(isValidEmail("user with spaces@domain.com")).toBe(false);
      expect(isValidEmail("@missinguser.com")).toBe(false);
    });
  });

  describe("validatePassword", () => {
    it("rejects empty or short passwords", () => {
      expect(validatePassword("").valid).toBe(false);
      expect(validatePassword("short1").valid).toBe(false);
      expect(validatePassword("short1").error).toContain("at least 8 characters");
    });

    it("evaluates password complexity scoring", () => {
      // 8 chars lowercase only
      const simple = validatePassword("password");
      expect(simple.valid).toBe(true);
      expect(simple.score).toBe(1);

      // Uppercase + numbers + special characters
      const strong = validatePassword("P@ssw0rd2026!");
      expect(strong.valid).toBe(true);
      expect(strong.score).toBe(4);
    });
  });

  describe("validateRegistrationForm", () => {
    it("validates compliant registration payload", () => {
      const result = validateRegistrationForm({
        name: "Amara Okonkwo",
        email: "amara@deepwater-oil.com",
        password: "SuperSecret123!",
        acceptedNda: true,
      });

      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it("requires confidentiality and NDA acceptance", () => {
      const result = validateRegistrationForm({
        name: "Amara Okonkwo",
        email: "amara@deepwater-oil.com",
        password: "SuperSecret123!",
        acceptedNda: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.acceptedNda).toContain("confidentiality and NDA");
    });

    it("catches multiple field validation errors simultaneously", () => {
      const result = validateRegistrationForm({
        name: "",
        email: "invalid-email",
        password: "123",
        acceptedNda: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
      expect(result.errors.acceptedNda).toBeDefined();
    });
  });

  describe("validatePasswordReset", () => {
    it("validates valid matching passwords", () => {
      const result = validatePasswordReset("NewSecret123!", "NewSecret123!");
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it("rejects mismatched passwords", () => {
      const result = validatePasswordReset("NewSecret123!", "DifferentSecret123!");
      expect(result.valid).toBe(false);
      expect(result.errors.confirmPassword).toContain("do not match");
    });

    it("rejects weak or short passwords", () => {
      const result = validatePasswordReset("short", "short");
      expect(result.valid).toBe(false);
      expect(result.errors.password).toContain("at least 8 characters");
    });

    it("rejects empty confirmation password", () => {
      const result = validatePasswordReset("ValidPassword123!", "");
      expect(result.valid).toBe(false);
      expect(result.errors.confirmPassword).toContain("required");
    });
  });
});
