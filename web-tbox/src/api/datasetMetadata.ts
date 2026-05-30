import { getAuthorizationHeader } from "../auth/session";
import { readJsonBody } from "./readJsonBody";

export type FlattenedMetadataJson = {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
};

export async function fetchFlattenedMetadata(
  datasetIds: string[],
): Promise<{ res: Response; body: FlattenedMetadataJson }> {
  const q = new URLSearchParams();
  for (const id of datasetIds) {
    q.append("dataset_ids", id);
  }
  const auth = getAuthorizationHeader();
  const res = await fetch(`/api/v1/datasets/metadata/flattened?${q.toString()}`, {
    headers: auth ? { Authorization: auth } : {},
  });
  const body = await readJsonBody<FlattenedMetadataJson>(res);
  return { res, body };
}

/** 从 flattened 响应提取 metadata key 列表（供 multi-select） */
export function metadataKeysFromFlattened(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  return Object.keys(data).sort();
}
