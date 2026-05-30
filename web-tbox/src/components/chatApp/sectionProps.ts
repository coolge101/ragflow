import type { ChatAppFormState, ChatLlmSetting, ChatPromptConfig } from "../../types/chatApp";

export type SectionProps = {
  form: ChatAppFormState;
  onChange: (patch: Partial<ChatAppFormState> | ((prev: ChatAppFormState) => ChatAppFormState)) => void;
  disabled?: boolean;
};

export function patchLlmSetting(
  onChange: SectionProps["onChange"],
  patch: Partial<ChatLlmSetting>,
): void {
  onChange((prev) => ({
    ...prev,
    llm_setting: { ...prev.llm_setting, ...patch },
  }));
}

export function patchPromptConfig(
  onChange: SectionProps["onChange"],
  patch: Partial<ChatPromptConfig>,
): void {
  onChange((prev) => ({
    ...prev,
    prompt_config: { ...prev.prompt_config, ...patch },
  }));
}
