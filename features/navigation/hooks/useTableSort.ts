import { useMemo, useRef, useState } from "react";
import type { TableSort } from "@/features/navigation/models/table-sort";

function compareValues(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function useTableSort<T, K extends string>(
  rows: T[],
  getValue: (row: T, key: K) => string | number,
  initial: TableSort<K>,
) {
  const [sort, setSort] = useState<TableSort<K>>(initial);
  const getValueRef = useRef(getValue);
  getValueRef.current = getValue;

  const toggle = (key: K) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = compareValues(getValueRef.current(a, sort.key), getValueRef.current(b, sort.key));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);

  return { sort, toggle, sorted };
}
