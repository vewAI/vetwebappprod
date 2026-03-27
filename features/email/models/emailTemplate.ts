/**
 * Email Template Models
 * Defines the structure for email templates used in authentication flows
 */

export interface EmailTemplate {
  id: string;
  type: "otp" | "magic_link";
  subject: string;
  htmlContent: string;
  variables: EmailTemplateVariable[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateVariable {
  name: string; // "ConfirmationURL", "Token", "Email"
  description: string;
  required: boolean;
  example: string;
}

export interface EmailContext {
  email: string;
  confirmationUrl?: string; // For magic_link template
  token?: string; // For OTP template (6-digit code)
  displayName?: string; // Extracted from email prefix
}

/**
 * OTP Email Template
 * Sent when user requests one-time password authentication
 */
export const otpEmailTemplate: EmailTemplate = {
  id: "otp-email",
  type: "otp",
  subject: "Your VewAi Verification Code",
  htmlContent: "", // Loaded from otp-template.html
  variables: [
    {
      name: "Token",
      description: "6-digit OTP code",
      required: true,
      example: "123456",
    },
    {
      name: "Email",
      description: "Recipient email address",
      required: true,
      example: "user@example.com",
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Magic Link Email Template
 * Sent when user requests passwordless login via magic link
 */
export const magicLinkEmailTemplate: EmailTemplate = {
  id: "magic-link-email",
  type: "magic_link",
  subject: "Your VewAi Login Link",
  htmlContent: "", // Loaded from magic-link-template.html
  variables: [
    {
      name: "ConfirmationURL",
      description: "Authentication URL for passwordless login",
      required: true,
      example: "https://vetwebappprod.com/auth/callback?token=xyz",
    },
    {
      name: "Email",
      description: "Recipient email address",
      required: true,
      example: "user@example.com",
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};
