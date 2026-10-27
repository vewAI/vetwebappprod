export interface BreadcrumbItem {
  label: string;
  /** Omitted on the current page. That item renders as text, not a link. */
  href?: string;
}
