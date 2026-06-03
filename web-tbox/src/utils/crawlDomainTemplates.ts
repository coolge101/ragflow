/** 四类专题库默认搜索 query 模板（Phase 67 discover） */

export const CRAWL_DOMAIN_TEMPLATES = {
  regulations: {
    label: "法规与标准",
    queries: ["TBOX 车联网 标准 法规", "C-V2X TBOX standard regulation"],
  },
  tech: {
    label: "技术发展趋势",
    queries: ["车联网 TBOX 技术架构 白皮书", "automotive TBOX technology trend"],
  },
  market: {
    label: "市场与产业趋势",
    queries: ["TBOX 市场规模 产业链", "connected vehicle TBOX market report"],
  },
  product: {
    label: "产品与行业情报",
    queries: ["TBOX 产品 竞品", "telematics box vendor comparison"],
  },
} as const;

export type CrawlDomainTemplateKey = keyof typeof CRAWL_DOMAIN_TEMPLATES;
