export type JourneyStep = {
  id: string;
  /** 短标题，用于侧栏式列表与 document.title */
  title: string;
  /** 动线顺序（0=全局） */
  order: number;
  /** 用于现场点验的真实业务路径（可能需登录与权限） */
  targetPath: string;
  /** 本步评审说明 */
  summary: string;
  /** 可勾选的验收要点（仅展示，勾选状态存浏览器本地） */
  acceptance: string[];
};

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "global",
    order: 0,
    title: "全局与动线 0",
    targetPath: "/",
    summary: "跨路由行为：标题、鉴权壳、与具体业务页解耦的能力。",
    acceptance: [
      "各路由浏览器标签标题为「模块名 · TBOX 知识库」",
      "未登录访问受保护 URL 会跳转到 /login 并带 redirect",
      "登录成功或已有会话会按 redirect 或进入首页",
    ],
  },
  {
    id: "login",
    order: 1,
    title: "登录",
    targetPath: "/login",
    summary: "账号进入系统：RSA 登录、健康检查、回跳与会话续期。",
    acceptance: [
      "可完成邮箱+密码登录并进入主界面",
      "已有有效会话时打开 /login 会自动跳走（不闪表单）",
      "redirect 不会指向 // 外链或 /login 死循环",
      "TBOX 健康检查失败或告警时可「重新检测」",
      "登录失败信息在必要时带 HTTP 状态码",
    ],
  },
  {
    id: "shell",
    order: 2,
    title: "工作台壳层",
    targetPath: "/",
    summary: "侧栏、顶栏、退出、权限菜单、同步失败提示等。",
    acceptance: [
      "侧栏仅展示当前账号 permissions 内的菜单",
      "顶栏展示用户标识并可退出",
      "/v1/tbox/me 失败时有重试或明确说明（见 ApiErrorBanner）",
      "窄屏（≤767px）顶栏有「菜单」，侧栏以抽屉打开；遮罩、Esc、选路由或「✕」可关闭",
    ],
  },
  {
    id: "chat",
    order: 3,
    title: "对话",
    targetPath: "/",
    summary: "主价值路径：应用、会话、流式、引用。",
    acceptance: [
      "可选择应用与会话并发送消息",
      "无应用时有空态说明，仍可「仅模型」",
      "无消息时有引导文案（按是否选应用/会话变化）",
      "流式输出可中止；中止不红错、不删已发用户句",
      "「仅模型」模式不传 chat_id",
      "有消息时可「导出 Markdown / PDF / Word / PPT」",
      "（Walkthrough L）Word/PPT 导出可用；大结果导出可有确认弹窗",
      "窄屏下引用区在消息区下方全宽展示",
      "新消息与流式输出时消息区自动滚到底部",
      "绑定知识库时点击 [ID:n] 与引用侧栏双向高亮",
    ],
  },
  {
    id: "chat-apps",
    order: 3.5,
    title: "对话应用",
    targetPath: "/apps",
    summary: "kb.configure 下创建/编辑对话应用，绑定知识库与 Prompt。",
    acceptance: [
      "侧栏可见「对话应用」（需 kb.configure）",
      "可新建应用并绑定知识库",
      "可从咨询/决策/辅导模板预填（/apps/new?template=…）",
      "保存后在对话页可选该应用",
      "发送消息后引用侧栏有 chunks（库内已有内容）",
      "点击回答中的引用编号，侧栏对应片段高亮并滚动可见",
      "用户可见文案无 RAGFlow",
    ],
  },
  {
    id: "search",
    order: 4,
    title: "检索",
    targetPath: "/search",
    summary: "选定知识库后的试用检索。",
    acceptance: [
      "可选知识库并发起检索",
      "无知识库时有说明；首次进入有操作引导",
      "检索成功但 0 条时有提示，并可「清空条件」",
      "有命中结果时可「导出 Markdown / PDF / Excel / PPT」",
      "（Walkthrough L）Excel/PPT 导出可用；大结果导出可有确认弹窗",
      "点击检索结果条目可高亮并滚动到可见区域",
      "修改问题或知识库后，旧结果自动清除",
      "错误可重试",
      "（可选）关键词/语义切换以接口能力为准",
    ],
  },
  {
    id: "documents",
    order: 5,
    title: "文档 / 知识库",
    targetPath: "/documents",
    summary: "知识库列表与文档上传、删除与状态展示。",
    acceptance: [
      "可展开知识库并列出文档及解析状态",
      "知识库、文档列表在总量大时可分页浏览",
      "有权限时可点击或拖入卡片上传；删文档含二次确认；删整库需 kb.dangerous",
      "切换知识库展开时文档页码回到第 1 页",
      "可展开 G1 多格式入库向导；Excel/图片上传时若分块方式不匹配有黄色提示",
      "（Walkthrough N/P）有 doc.reparse 时可重新解析；有 export.data 时可 ZIP 导入/导出",
    ],
  },
  {
    id: "kb",
    order: 6,
    title: "知识库配置",
    targetPath: "/kb",
    summary: "单库 GET/PUT 官方 datasets 配置；整库删除需 kb.dangerous。",
    acceptance: [
      "有 kb.configure 时可选择知识库并加载详情",
      "可编辑名称、描述、嵌入模型、分块方法、permission、parser_config（JSON）并保存",
      "有 kb.dangerous 时删除整库含二次确认；无权限时仅提示说明",
    ],
  },
  {
    id: "crawl",
    order: 7,
    title: "采集",
    targetPath: "/crawl",
    summary: "TBOX 采集任务 CRUD、调度与执行一次。",
    acceptance: [
      "列表、新建、编辑、删除、执行一次可用",
      "可选「专项 / 定时」任务类型；可填关键词、深度、允许域名",
      "extra_config 勾选与 JSON 与后端契约一致；策略键由 worker 消费",
      "（Walkthrough M）可选 HTTP API 种子、认证 Header 配置名；任务可创建并执行一次",
    ],
  },
  {
    id: "audit",
    order: 8,
    title: "审计",
    targetPath: "/audit",
    summary: "入库/流水线 ingestions 日志。",
    acceptance: [
      "可切换知识库与 log_type 查看日志",
      "（Walkthrough O）时间/类型/状态/关键词筛选；有 export.data 时可导出 CSV/Excel",
    ],
  },
  {
    id: "users",
    order: 9,
    title: "用户与角色",
    targetPath: "/users",
    summary: "工作区成员与 TBOX 权限、托管用户。",
    acceptance: [
      "可选工作区并管理成员（权限与后端一致）",
      "创建用户 RSA 密码等与文档一致",
    ],
  },
  {
    id: "vm-5180",
    order: 10.5,
    title: "准生产 5180",
    targetPath: "/documents",
    summary: "Docker tbox-console（5180）；自动化 smoke + VM 手测 §3–4。",
    acceptance: [
      "bash scripts/tbox_pre_release.sh 或 tbox_vm_production_acceptance.sh 退出码 0",
      "http://<LAN-IP>:5180/login 可登录（非 5174 dev）",
      "admin 与普通用户侧栏随 permissions 不同（VM §3 A–D）",
      "步骤 C §7 Citation + 步骤 D 检索高亮在 5180 通过",
      "Phase 16–17 通过后 bash scripts/tbox_phase16_17_finish.sh --archive",
      "可选：deploy-on-new-server 后 TBOX_CONSOLE=1 起 5180",
    ],
  },
  {
    id: "errors",
    order: 11,
    title: "无权限与 404",
    targetPath: "/no-permission",
    summary: "异常出口与回退路径。",
    acceptance: [
      "无权限页展示所需 permission 与返回/首页入口",
      "未知路径进入 404 页并可回首页",
    ],
  },
];

export function journeyStepById(id: string): JourneyStep | undefined {
  return JOURNEY_STEPS.find((s) => s.id === id);
}

/** 供 `document.title` 使用；非评审路由返回 null */
export function reviewDocumentTitle(pathname: string): string | null {
  if (pathname === "/review") {
    return "页面确认索引";
  }
  const prefix = "/review/step/";
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const id = pathname.slice(prefix.length).split("/")[0] ?? "";
  const step = journeyStepById(id);
  if (!step) {
    return "确认页";
  }
  return `确认：${step.title}`;
}
