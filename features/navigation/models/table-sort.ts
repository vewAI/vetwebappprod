export type SortDir = "asc" | "desc";

export interface TableSort<K extends string> {
  key: K;
  dir: SortDir;
}
