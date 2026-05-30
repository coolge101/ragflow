import type { ChatAppFormState } from "../types/chatApp";
import { createEmptyChatAppForm } from "./chatAppDefaults";

export type ChatAppScenarioId = "consultation" | "decision" | "coaching";

const KNOWLEDGE_BLOCK = [
  "Here is the knowledge base:",
  "{knowledge}",
  "The above is the knowledge base.",
].join("\n");

export const CHAT_APP_SCENARIOS: Array<{
  id: ChatAppScenarioId;
  label: string;
  description: string;
}> = [
  {
    id: "consultation",
    label: "咨询",
    description: "面向知识库问答与信息检索，语气客观、引用清晰。",
  },
  {
    id: "decision",
    label: "决策",
    description: "对比选项、列出利弊与风险，给出可执行建议。",
  },
  {
    id: "coaching",
    label: "辅导",
    description: "分步引导与练习反馈，适合学习与能力提升。",
  },
];

const SCENARIO_IDS = new Set<string>(CHAT_APP_SCENARIOS.map((s) => s.id));

export function isChatAppScenarioId(v: string | null | undefined): v is ChatAppScenarioId {
  return v != null && SCENARIO_IDS.has(v);
}

export function createChatAppFormFromScenario(id: ChatAppScenarioId): ChatAppFormState {
  const base = createEmptyChatAppForm();

  if (id === "consultation") {
    return {
      ...base,
      name: "咨询助手",
      description: "基于知识库回答业务与政策类问题，并标注引用来源。",
      prompt_config: {
        ...base.prompt_config,
        system: [
          "你是 TBOX 咨询助手。请基于知识库内容准确、简洁地回答用户问题。",
          "若知识库与问题无关，请明确说明未找到相关信息，不要编造。",
          "回答时优先引用知识库要点；必要时用条目列出关键事实。",
          KNOWLEDGE_BLOCK,
        ].join("\n"),
        prologue: "你好，我是咨询助手。请描述你的问题，我会结合知识库为你解答。",
        quote: true,
        refine_multiturn: true,
      },
      top_n: 8,
      similarity_threshold: 0.15,
    };
  }

  if (id === "decision") {
    return {
      ...base,
      name: "决策助手",
      description: "在知识库约束下对比方案、分析利弊并给出决策建议。",
      prompt_config: {
        ...base.prompt_config,
        system: [
          "你是 TBOX 决策助手。请基于知识库与用户问题，帮助用户做结构化决策分析。",
          "输出建议包含：背景摘要、可选方案、各方案利弊、风险与前提、推荐结论（含理由）。",
          "若知识库信息不足，请列出缺失信息并给出保守建议，不要虚构数据。",
          KNOWLEDGE_BLOCK,
        ].join("\n"),
        prologue: "你好，我是决策助手。请说明决策背景、目标与约束，我会帮你梳理方案。",
        quote: true,
        reasoning: true,
        refine_multiturn: true,
      },
      top_n: 10,
      similarity_threshold: 0.12,
      vector_similarity_weight: 0.35,
    };
  }

  return {
    ...base,
    name: "辅导助手",
    description: "分步引导学习与实践，结合知识库提供示例与反馈。",
    prompt_config: {
      ...base.prompt_config,
      system: [
        "你是 TBOX 辅导助手。请结合知识库，以分步、鼓励的方式引导用户学习或练习。",
        "每次回答尽量：确认用户目标 → 给出 1–3 个可执行步骤 → 提供自检问题或小结。",
        "避免一次性灌输过长内容；若知识库无相关内容，请诚实说明并给出通用学习建议。",
        KNOWLEDGE_BLOCK,
      ].join("\n"),
      prologue: "你好，我是辅导助手。告诉我你想学习或提升的主题，我们一步步来。",
      quote: true,
      refine_multiturn: true,
    },
    top_n: 6,
    llm_setting: { ...base.llm_setting, temperature: 0.3, max_tokens: 768 },
  };
}
