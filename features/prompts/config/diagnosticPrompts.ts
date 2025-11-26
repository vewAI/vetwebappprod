export const DIAGNOSTIC_FINDINGS_HEADER_PROMPT_ID = "diagnostic-findings.header";
export const DIAGNOSTIC_FINDINGS_FOOTER_PREFIX_PROMPT_ID =
  "diagnostic-findings.footer-prefix";
export const DIAGNOSTIC_FINDINGS_FOOTER_SUFFIX_PROMPT_ID =
  "diagnostic-findings.footer-suffix";

export interface DiagnosticPromptCopy {
  header: string;
  footerPrefix: string;
  footerSuffix: string;
}

export const DEFAULT_DIAGNOSTIC_PROMPT_COPY: DiagnosticPromptCopy = {
  header: "Diagnostics available on request:",
  footerPrefix: "Disclose data only when the learner asks for it during",
  footerSuffix: "'s case.",
};

const sanitiseLine = (value: string | undefined, fallback: string): string => {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export function buildDiagnosticPromptCopy(
  overrides?: Partial<DiagnosticPromptCopy>
): DiagnosticPromptCopy {
  return {
    header: sanitiseLine(overrides?.header, DEFAULT_DIAGNOSTIC_PROMPT_COPY.header),
    footerPrefix: sanitiseLine(
      overrides?.footerPrefix,
      DEFAULT_DIAGNOSTIC_PROMPT_COPY.footerPrefix
    ),
    footerSuffix: sanitiseLine(
      overrides?.footerSuffix,
      DEFAULT_DIAGNOSTIC_PROMPT_COPY.footerSuffix
    ),
  };
}
