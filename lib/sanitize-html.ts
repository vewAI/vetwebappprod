import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes HTML content so it is safe to inject via `dangerouslySetInnerHTML`.
 * Uses DOMPurify profiles tuned for general HTML nodes (no SVG/MathML allowed).
 */
export function sanitizeHtml(content: string | null | undefined): string {
  if (!content) {
    return "";
  }

  return DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
  });
}
