import { ChunkListPanel } from "./ChunkListPanel";
import type { ChunkRow } from "../api/datasetSearch";
import { chunkRowToDisplayItem, formatChunkSnippet } from "../utils/chunkDisplay";

type Props = {
  chunks: ChunkRow[];
  activeIndex?: number | null;
  onSelectChunk?: (index: number) => void;
};

/** 检索结果列表：可点击高亮，与对话页引用侧栏交互一致 */
export function SearchResultList({ chunks, activeIndex = null, onSelectChunk }: Props) {
  const items = chunks.map((c, i) => chunkRowToDisplayItem(c, i));

  return (
    <ChunkListPanel
      items={items}
      activeIndex={activeIndex}
      onSelectChunk={onSelectChunk}
      ariaLabel="检索结果片段"
      emptyMessage="暂无结果"
      listAs="ol"
      density="comfortable"
      selectLabelPrefix="结果"
    />
  );
}

export function searchChunkSnippet(c: ChunkRow): string {
  return formatChunkSnippet(chunkRowToDisplayItem(c, 0));
}
