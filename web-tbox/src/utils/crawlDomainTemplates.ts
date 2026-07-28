/** 四类专题库默认搜索 query 模板（Phase 67 discover） */

export const CRAWL_DOMAIN_TEMPLATES = {
  regulations: {
    label: "法规与标准",
    queries: ["TBOX 车联网 标准 法规", "C-V2X TBOX standard regulation"],
    seedUrls: [
      "https://www.miit.gov.cn/",
      "https://www.cttic.cn/",
      "https://www.gov.cn/zhengce/",
    ],
    /** 留空表示不过滤；套用模板时不覆盖用户已填关键词 */
    keywords: [] as string[],
  },
  tech: {
    label: "技术发展趋势",
    queries: ["车联网 TBOX 技术架构 白皮书", "automotive TBOX technology trend"],
    seedUrls: ["https://www.miit.gov.cn/", "https://www.cttic.cn/"],
    keywords: ["车联网", "TBOX", "技术", "白皮书", "automotive", "technology", "智能网联", "新能源汽车", "5G"],
  },
  market: {
    label: "市场与产业趋势",
    queries: ["TBOX 市场规模 产业链", "connected vehicle TBOX market report"],
    seedUrls: ["https://www.miit.gov.cn/"],
    keywords: ["TBOX", "车联网", "市场", "产业", "产业链", "market", "report"],
  },
  product: {
    label: "产品与行业情报",
    queries: ["TBOX 产品 竞品", "telematics box vendor comparison"],
    seedUrls: ["https://www.miit.gov.cn/"],
    keywords: ["TBOX", "产品", "竞品", "telematics", "vendor", "comparison"],
  },
} as const;

export type CrawlDomainTemplateKey = keyof typeof CRAWL_DOMAIN_TEMPLATES;
