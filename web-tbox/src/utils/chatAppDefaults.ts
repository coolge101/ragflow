import type { ChatAppFormState } from "../types/chatApp";

const DEFAULT_SYSTEM = [
  "You are an intelligent assistant. Please summarize the content of the dataset to answer the question.",
  "Please list the data in the dataset and answer in detail. When all dataset content is irrelevant to the question,",
  'your answer must include the sentence "The answer you are looking for is not found in the dataset!"',
  "Answers need to consider chat history.",
  "      Here is the knowledge base:",
  "      {knowledge}",
  "      The above is the knowledge base.",
].join(" ");

export function createEmptyChatAppForm(): ChatAppFormState {
  return {
    name: "",
    description: "",
    language: "Chinese",
    icon: "",
    dataset_ids: [],
    llm_id: "",
    llm_setting: {
      temperature: 0.1,
      top_p: 0.3,
      frequency_penalty: 0.7,
      presence_penalty: 0.4,
      max_tokens: 512,
    },
    prompt_config: {
      system: DEFAULT_SYSTEM,
      prologue: "Hi! I'm your assistant. What can I do for you?",
      empty_response: "Sorry! No relevant content was found in the knowledge base!",
      parameters: [{ key: "knowledge", optional: false }],
      quote: true,
      keyword: false,
      tts: false,
      refine_multiturn: true,
      use_kg: false,
      reasoning: false,
      toc_enhance: false,
      cross_languages: [],
      reference_metadata: { include: false, fields: undefined },
    },
    top_n: 6,
    top_k: 1024,
    similarity_threshold: 0.1,
    vector_similarity_weight: 0.3,
    rerank_id: "",
    meta_data_filter: { method: "disabled", manual: [], semi_auto: [] },
  };
}

/** 将 GET /chats/:id 的 data 转为表单（缺省字段回落到 createEmpty） */
export function chatDetailToForm(data: Record<string, unknown>): ChatAppFormState {
  const base = createEmptyChatAppForm();
  const pc = (data.prompt_config as Record<string, unknown>) ?? {};
  const rm = (pc.reference_metadata as Record<string, unknown>) ?? {};
  return {
    ...base,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    language: (data.language === "English" ? "English" : "Chinese") as "English" | "Chinese",
    icon: String(data.icon ?? ""),
    dataset_ids: Array.isArray(data.dataset_ids) ? data.dataset_ids.map(String) : [],
    llm_id: String(data.llm_id ?? ""),
    llm_setting: { ...base.llm_setting, ...(data.llm_setting as object) },
    prompt_config: {
      ...base.prompt_config,
      system: String(pc.system ?? base.prompt_config.system),
      prologue: String(pc.prologue ?? base.prompt_config.prologue),
      empty_response: String(pc.empty_response ?? base.prompt_config.empty_response),
      parameters: Array.isArray(pc.parameters)
        ? (pc.parameters as ChatAppFormState["prompt_config"]["parameters"])
        : base.prompt_config.parameters,
      quote: Boolean(pc.quote ?? base.prompt_config.quote),
      keyword: Boolean(pc.keyword ?? base.prompt_config.keyword),
      tts: Boolean(pc.tts ?? base.prompt_config.tts),
      refine_multiturn: Boolean(pc.refine_multiturn ?? base.prompt_config.refine_multiturn),
      use_kg: Boolean(pc.use_kg ?? base.prompt_config.use_kg),
      reasoning: Boolean(pc.reasoning ?? base.prompt_config.reasoning),
      toc_enhance: Boolean(pc.toc_enhance ?? base.prompt_config.toc_enhance),
      tavily_api_key: pc.tavily_api_key ? String(pc.tavily_api_key) : undefined,
      cross_languages: Array.isArray(pc.cross_languages) ? pc.cross_languages.map(String) : [],
      reference_metadata: {
        include: Boolean(rm.include),
        fields: Array.isArray(rm.fields) ? rm.fields.map(String) : undefined,
      },
    },
    top_n: Number(data.top_n ?? base.top_n),
    top_k: Number(data.top_k ?? base.top_k),
    similarity_threshold: Number(data.similarity_threshold ?? base.similarity_threshold),
    vector_similarity_weight: Number(data.vector_similarity_weight ?? base.vector_similarity_weight),
    rerank_id: String(data.rerank_id ?? ""),
    meta_data_filter: {
      ...(base.meta_data_filter as object),
      ...(data.meta_data_filter as object),
    },
  };
}

export function toChatApiPayload(form: ChatAppFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description,
    language: form.language,
    icon: form.icon,
    dataset_ids: form.dataset_ids,
    llm_id: form.llm_id || undefined,
    llm_setting: form.llm_setting,
    prompt_config: {
      ...form.prompt_config,
      parameters: form.prompt_config.parameters.filter((p) => p.key.trim() !== ""),
      reference_metadata: form.prompt_config.reference_metadata?.include
        ? form.prompt_config.reference_metadata
        : { include: false, fields: undefined },
    },
    top_n: form.top_n,
    top_k: form.top_k,
    similarity_threshold: form.similarity_threshold,
    vector_similarity_weight: form.vector_similarity_weight,
    rerank_id: form.rerank_id,
    meta_data_filter: form.meta_data_filter,
  };
  return payload;
}

export function validateChatAppForm(form: ChatAppFormState): string | null {
  if (!form.name.trim()) {
    return "请填写应用名称。";
  }
  if (form.dataset_ids.length > 0 && !form.prompt_config.system.includes("{knowledge}")) {
    return "已绑定知识库时，System Prompt 建议包含 {knowledge} 占位符。";
  }
  return null;
}
