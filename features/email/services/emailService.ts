/**
 * Email Service
 * Utilities for handling email template rendering and validation
 */

import type { EmailContext, EmailTemplate } from "../models/emailTemplate";

/**
 * Validates that all required variables are present in the context
 * @param template - Email template with required variables
 * @param context - Email context to validate
 * @throws Error if required variables are missing
 */
export function validateEmailContext(template: EmailTemplate, context: EmailContext): void {
  const requiredVars = template.variables.filter((v) => v.required);

  for (const variable of requiredVars) {
    const varName = variable.name.toLowerCase();

    if (varName === "token" && !context.token) {
      throw new Error(`Missing required variable: ${variable.name}`);
    }

    if (varName === "confirmationurl" && !context.confirmationUrl) {
      throw new Error(`Missing required variable: ${variable.name}`);
    }

    if (varName === "email" && !context.email) {
      throw new Error(`Missing required variable: ${variable.name}`);
    }
  }
}

/**
 * Renders email template with variables from context
 * @param template - Email template with variable placeholders
 * @param context - Email context containing values
 * @returns Rendered HTML string
 */
export function renderEmailTemplate(template: EmailTemplate, context: EmailContext): string {
  validateEmailContext(template, context);

  let rendered = template.htmlContent;

  // Replace Supabase style variables: {{ .VariableName }}
  rendered = rendered.replace(/\{\{\.ConfirmationURL\}\}/g, context.confirmationUrl || "");
  rendered = rendered.replace(/\{\{\.Token\}\}/g, context.token || "");
  rendered = rendered.replace(/\{\{\.Email\}\}/g, context.email || "");

  // Also support lowercase for convenience
  rendered = rendered.replace(/\{\{\.confirmationUrl\}\}/g, context.confirmationUrl || "");
  rendered = rendered.replace(/\{\{\.token\}\}/g, context.token || "");
  rendered = rendered.replace(/\{\{\.email\}\}/g, context.email || "");

  return rendered;
}

/**
 * Extracts display name from email address
 * @param email - Email address
 * @returns Display name (part before @)
 */
export function getDisplayNameFromEmail(email: string): string {
  const [name] = email.split("@");
  return name
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Formats a 6-digit OTP code for display
 * @param code - Raw OTP code
 * @returns Formatted code with spaces
 */
export function formatOtpCode(code: string): string {
  if (code.length !== 6) {
    return code;
  }
  return code.split("").reduce((acc, char, idx) => {
    if (idx > 0 && idx % 2 === 0) {
      return acc + " " + char;
    }
    return acc + char;
  }, "");
}

/**
 * Validates email address format
 * @param email - Email to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Gets email template metadata for display/logging
 * @param template - Email template
 * @returns Template metadata
 */
export function getTemplateMetadata(template: EmailTemplate) {
  return {
    id: template.id,
    type: template.type,
    subject: template.subject,
    variableCount: template.variables.length,
    requiredVariables: template.variables.filter((v) => v.required).map((v) => v.name),
  };
}
