/** Legacy unified crawl KB — no longer the default sync target. */
export const DEFAULT_CRAWL_DATASET_ID =
  (import.meta.env.VITE_DEFAULT_CRAWL_DATASET_ID as string | undefined)?.trim() ||
  "d9a24c90755711f183f9411afcfa157e";

/** Domain crawl KBs used for split ingest + multi-select search (方案 1). */
export const DOMAIN_CRAWL_DATASETS = [
  {
    domain: "COMP",
    id: "4e2c5f74897611f1b2b6e924ebaae404",
    label: "TBOX-Crawl-Product",
    nameIncludes: "Crawl-Product",
  },
  {
    domain: "MA",
    id: "4e36ee9e897611f1b2b6e924ebaae404",
    label: "TBOX-Crawl-Market",
    nameIncludes: "Crawl-Market",
  },
  {
    domain: "TD",
    id: "4e3d147c897611f1b2b6e924ebaae404",
    label: "TBOX-Crawl-Technology",
    nameIncludes: "Crawl-Technology",
  },
  {
    domain: "RS",
    id: "4e413dea897611f1b2b6e924ebaae404",
    label: "TBOX-Crawl-Regulatory",
    nameIncludes: "Crawl-Regulatory",
  },
] as const;

export type DatasetLike = { id?: string | null; name?: string | null };

export function parseKbParam(kb: string | null | undefined): string[] {
  if (!kb?.trim()) {
    return [];
  }
  return kb
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveDomainCrawlDatasetIds(rows: DatasetLike[]): string[] {
  const ids: string[] = [];
  for (const spec of DOMAIN_CRAWL_DATASETS) {
    const byId = rows.find((r) => String(r.id) === spec.id);
    if (byId?.id) {
      ids.push(String(byId.id));
      continue;
    }
    const byName = rows.find((r) => String(r.name || "").includes(spec.nameIncludes));
    if (byName?.id) {
      ids.push(String(byName.id));
    }
  }
  return ids;
}

export function pickPreferredDatasetId(
  rows: DatasetLike[],
  preferredId = DEFAULT_CRAWL_DATASET_ID,
): string {
  const domainIds = resolveDomainCrawlDatasetIds(rows);
  if (domainIds.length > 0) {
    return domainIds[0];
  }
  if (preferredId && rows.some((r) => String(r.id) === preferredId)) {
    return preferredId;
  }
  const byName = rows.find((r) => String(r.name || "").includes("四域爬取"));
  if (byName?.id) {
    return String(byName.id);
  }
  return rows[0]?.id ? String(rows[0].id) : "";
}

export function datasetLabelForId(rows: DatasetLike[], id: string): string {
  const row = rows.find((r) => String(r.id) === id);
  if (row?.name) {
    return String(row.name);
  }
  const known = DOMAIN_CRAWL_DATASETS.find((d) => d.id === id);
  return known?.label || id;
}
