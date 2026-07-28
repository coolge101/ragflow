export type ChatParameter = { key: string; optional: boolean };

export type ChatReferenceMetadata = {
  include?: boolean;
  fields?: string[];
};

export type ChatPromptConfig = {
  system: string;
  prologue: string;
  empty_response: string;
  parameters: ChatParameter[];
  quote: boolean;
  keyword: boolean;
  tts: boolean;
  refine_multiturn: boolean;
  use_kg: boolean;
  reasoning: boolean;
  toc_enhance: boolean;
  tavily_api_key?: string;
  cross_languages?: string[];
  reference_metadata?: ChatReferenceMetadata;
};

export type ChatLlmSetting = {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
};

export type MetaDataFilterManualCondition = {
  key: string;
  op: string;
  value: string | string[];
};

export type MetaDataFilter = {
  method?: "disabled" | "auto" | "semi_auto" | "manual" | string;
  logic?: string;
  manual?: MetaDataFilterManualCondition[];
  semi_auto?: Array<string | { key: string; op?: string }>;
};

export type ChatAppFormState = {
  name: string;
  description: string;
  language: "English" | "Chinese";
  icon: string;
  dataset_ids: string[];
  llm_id: string;
  llm_setting: ChatLlmSetting;
  prompt_config: ChatPromptConfig;
  top_n: number;
  top_k: number;
  similarity_threshold: number;
  vector_similarity_weight: number;
  rerank_id: string;
  meta_data_filter: MetaDataFilter;
};

export type ChatAppDetail = ChatAppFormState & {
  id?: string;
  kb_names?: string[];
  create_time?: string;
  update_time?: string;
};
