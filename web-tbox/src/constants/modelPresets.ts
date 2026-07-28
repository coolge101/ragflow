/**
 * 常用「模型@厂商」预设（与 RAGFlow conf/models 中厂商名一致），用于下拉中补充国产/常见云模型。
 * 若与 `/v1/llm/list` 返回重复，会去重；未在列表中的部署仍可经「其他」手动输入。
 */
export const CHAT_MODEL_PRESETS: { value: string; label: string }[] = [
  { value: "deepseek-v4-flash@DeepSeek", label: "deepseek-v4-flash @ DeepSeek（对话）" },
  { value: "deepseek-v4-pro@DeepSeek", label: "deepseek-v4-pro @ DeepSeek（对话）" },
  { value: "qwen/qwen3-8b@SiliconFlow", label: "qwen/qwen3-8b @ SiliconFlow" },
  { value: "qwen/qwen3.5-4b@SiliconFlow", label: "qwen/qwen3.5-4b @ SiliconFlow" },
  { value: "glm-5@ZHIPU-AI", label: "glm-5 @ ZHIPU-AI（智谱）" },
  { value: "glm-5-turbo@ZHIPU-AI", label: "glm-5-turbo @ ZHIPU-AI" },
  { value: "qwen-flash@Aliyun", label: "qwen-flash @ Aliyun（通义）" },
  { value: "gpt-4o-mini@OpenAI", label: "gpt-4o-mini @ OpenAI" },
  { value: "gpt-4o@OpenAI", label: "gpt-4o @ OpenAI" },
];

export const EMBEDDING_MODEL_PRESETS: { value: string; label: string }[] = [
  { value: "Qwen/Qwen3-Embedding-0.6B@SiliconFlow", label: "Qwen/Qwen3-Embedding-0.6B @ SiliconFlow" },
  { value: "text-embedding-3-small@OpenAI", label: "text-embedding-3-small @ OpenAI" },
  { value: "text-embedding-3-large@OpenAI", label: "text-embedding-3-large @ OpenAI" },
  { value: "embedding-3@ZHIPU-AI", label: "embedding-3 @ ZHIPU-AI（智谱）" },
  { value: "embedding-2@ZHIPU-AI", label: "embedding-2 @ ZHIPU-AI" },
];

export const SPEECH2TEXT_PRESETS: { value: string; label: string }[] = [
  { value: "paraformer-realtime-v2@Aliyun", label: "paraformer-realtime-v2 @ Aliyun（示例）" },
];

export const IMAGE2TEXT_PRESETS: { value: string; label: string }[] = [
  { value: "glm-4v-flash@ZHIPU-AI", label: "glm-4v-flash @ ZHIPU-AI（示例）" },
];
