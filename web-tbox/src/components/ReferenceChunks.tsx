import { ChunkListPanel } from "./ChunkListPanel";
import { chunksFromReference } from "../utils/chunkDisplay";

type Props = {
  reference: unknown;
  activeChunkIndex?: number | null;
  onSelectChunk?: (chunkIndex: number) => void;
};

/** 展示 RAGFlow `structure_answer` 返回的 reference.chunks（已 chunks_format） */
export function ReferenceChunks({ reference, activeChunkIndex = null, onSelectChunk }: Props) {
  const items = chunksFromReference(reference);

  return (
    <ChunkListPanel
      items={items}
      activeIndex={activeChunkIndex}
      onSelectChunk={onSelectChunk}
      ariaLabel="引用片段"
      emptyMessage="暂无引用"
      listAs="ul"
      density="compact"
      selectLabelPrefix="引用"
    />
  );
}
