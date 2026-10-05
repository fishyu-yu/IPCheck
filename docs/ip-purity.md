# IP 纯净度：本地模型 v2

`GET /api/purity/{ip}` 对公网 IPv4 / IPv6 返回完整评估。无需配置风险服务密钥，首页、IP 查询和 `/risk` 均提供纯净度；原 `/api/risk/{ip}` 保持原有第三方风险协议。

## 分数与证据

纯净度为 0–100 分，越高表示已观测证据越干净。它是可解释的工程启发式，不是经过真实标注样本校准的欺诈概率。权重位于 `src/config/purity.config.ts`，确定性计算位于 `src/lib/purity.ts`。

| 因素         | 权重 | 依据                                                        |
| ------------ | ---- | ----------------------------------------------------------- |
| ASN 类型     | 15%  | 路由组织的 ISP / hosting / business 等分类                  |
| Company 类型 | 20%  | IP 使用组织的独立分类，允许与 ASN 类型不同                  |
| 匿名网络     | 30%  | VPN、proxy、Tor；相关信号取最强风险，避免重复累加           |
| 近期滥用     | 25%  | 直接威胁命中、滥用比例、机器人及黑名单证据                  |
| 邻居风险     | 10%  | IPv4 `/24` 中的近期恶意邻居，以及特定公司网段的滥用地址比例 |

每个缺失因素取 50 分中性值。没有任何可用证据时返回 **50 分／证据不足／低置信度**、五项明细和缺失说明；断网时仍可使用有效的本地网络快照。不返回空分数或默认 100 分。名称推断仅按半强度使用，界面标注“推断”。ASN 为 ISP 不代表 IP 一定是住宅，也不豁免代理或滥用证据。

不同因素的证据覆盖强度按权重合计为 `coverage`。名称推断、单一匿名检查和有限公共名单的阴性结果仅提供部分覆盖。覆盖率达到 75% 才标为完整评估；高纯净度还须总分至少 85、没有直接不利证据和明确托管标记。High / Medium / Low 为模型对证据的定性信心，不是统计概率。

强证据优先：直接命中 Spamhaus DROP 或 Feodo 近期 C2 时总分上限 10；强滥用证据上限 25；Tor 或明确公共代理上限 30。VPN、代理、Tor 共用一个评分因素；同信号多个来源取较强值，冲突保留。邻居有问题只影响邻居因素，不自动认定目标 IP 恶意。数值风险增加不会提高纯净度。

v2 根据来源置信度折扣推断信号，邻居计数和网段密度分别按自己的强度贡献，不能用更强的密度来源放大较弱的邻居罚分。公司名称猜测不会触发明确托管证据的硬上限。各评分因素返回 `reliability`；`scoreRange` 表示缺失证据的敏感性范围（分数 ± 未覆盖权重的一半，再应用风险封顶），不是统计置信区间。`recommendations` 给出与实际发现对应的建议。页面逐项显示检测值、来源、置信度、推断方式、冲突和缺失项。

## 默认来源与实际范围

- [IPQuery 官方接口](https://ipquery.io/)：官方明确允许无需密钥的免费商用，支持 IPv4 / IPv6。仅使用文档定义的 VPN、proxy、Tor、datacenter 四个布尔特征；缺失、null、错误、错误目标响应都保持未知，不使用 `risk_score` 作为独立滥用或直接纯净度分数。来源没有提供准确率、事件时间、数值配额或 SLA，本模型分别显示未知置信度与实际获取时间，设置超时、缓存与故障冷却，避免依赖其持续可用。
- [X4B 严格 VPN 前缀](https://github.com/X4BNet/lists_vpn/blob/main/README.md)：随代码携带 10,939 条前缀，只在命中时产生 0.6 强度的 VPN 推断，未命中不产生 `vpn=false`。不用范围更广的 datacenter 表替代 VPN 检测；快照 7 天失效。许可为 MIT，完整许可保留在 `api/purity/data/ATTRIBUTION.md`。
- [Google Cloud 官方公开前缀](https://docs.cloud.google.com/compute/docs/faq#where_can_i_find_compute_engine_ip_ranges)：随代码携带 1,107 条 IPv4 / IPv6 前缀，匹配确定云网络用途，仅补充 Company 网络类型与 hosting 标记，不修改 ASN 分类，也不产生滥用证据。Google DNS 8.8.8.8 不在该 Cloud 列表；快照 30 天失效。

- [Tor Project 出口列表](https://check.torproject.org/api/bulk)：匹配已知出口；地址族无覆盖时保持未知。未命中不等于排除 VPN、住宅代理或所有 Tor 出口用途。
- [Spamhaus Project DROP](https://www.spamhaus.org/blocklists/do-not-route-or-peer/)：按目标地址族选择 IPv4 / IPv6 CIDR 列表。保留并展示发布日期、版权和来源链接；只接受最近 48 小时的元数据，成功或失败均至少间隔一小时再拉取。
- [abuse.ch Feodo Tracker 推荐列表](https://feodotracker.abuse.ch/blocklist/)：官方针对在线或近数小时的已确认 C2。每 15 分钟拉取，拒绝超过 24 小时的响应修改时间；离线条目只接受 24 小时内观测。该数据可依 CC0 商用。计数去重并排除目标 IP，本项标为“近期恶意邻居”。
- [CINS Army](https://cinsscore.com/)：Feodo 不可用或地址族无覆盖时的备选名单，依据恶意数据包与多个 Sentinel 告警生成。官方允许解析与使用，上限 15,000 个 IP；每小时刷新，须有最近 24 小时的有效修改时间。它没有逐条活动时间，界面单独标为“当前威胁名单邻居”，不能当作近几小时在线活动；目标直接命中作为 0.6 的中强滥用证据，不套用已确认 C2 的 10 分封顶。
- ipwho.is / 已配置 IPinfo：获取组织元数据。IPinfo 返回的 ASN、Company 类型独立保留；缺失分类时采用保守的组织名称提示，并明确标注推断。

邻居计数来自既有公共情报，**不是流量测量、在线设备比例或主动端口扫描**。PTR 有记录不证明在线，BGP 的 ASN 邻接也不是 IP 邻居。IPv6 不枚举 `/64`，无地址族覆盖时不给阴性加分。Company 网段滥用比例与 `/24` 威胁邻居使用不同网络范围和来源分别展示。

2026-10-04 的真实网络验收发现 Feodo 推荐列表返回数月前的修改时间，程序将其拒绝并使用及时的 CINS 快照。若两者均无法提供有效数据，邻居仍显示明确的不可用说明并按中性分贡献。

## 可选补强

设置服务端 `IPAPI_KEY` 后使用 [ipapi.is 完整接口](https://ipapi.is/developers.html)，读取 ASN / Company 类型、VPN / proxy / Tor / datacenter / abuser 标记和 `company.abuser_score`。后者是该组织 WHOIS 网段内的滥用地址比例，不是实时在线率；仅在响应网段包含目标 IP、比例为合法 0–1 时使用。

截至 2026-10-04，[ipapi.is 匿名接口](https://ipapi.is/free-tier.html) 已将 ASN / Company 简化为字符串，不再提供所需类型和安全字段，因此本实现不请求匿名接口。已有 `IPQS_KEY` / `ABUSEIPDB_KEY` 会作为补充来源；密钥不配置也可以评估。密钥仅作为服务器 Secret，禁止 `VITE_` 前缀。

`PROXYCHECK_KEY` 可启用自有账户的 [Proxycheck v3](https://proxycheck.io/api/) 特征补充。采用固定 2026-06-24 API 版本、禁用检测日志标记；提取匿名网络、明确 compromised 及 allocation usage，保持 Company 与 ASN 独立。其风险分本身含 hosting / VPN 基线，因此不当作第二项滥用证据。明显过期或未来的记录、超过 7 天的正向观测保持未知；来源声明的正向置信度参与本地计算。[其条款](https://proxycheck.io/terms/)限制数据镜像和转售，本实现仅提供自有密钥可配置的特征适配，不依赖匿名共享配额、不输出完整供应商数据。

`PURITY_PUBLIC_FEEDS=off` 关闭威胁名单和网络前缀刷新，仍保留有效的本地前缀快照；`PURITY_IPQUERY=off` 单独关闭默认 IPQuery 补充。完全离线可同时关闭这两项和 `GEO_FREE_PROVIDER`、不设置服务端密钥，仍返回完整本地估算结果。

## 生产运行

基础情报请求并行、单个请求超时 4.5 秒、响应最大 2 MB，拒绝重定向及无效格式；DROP、Feodo 和 CINS 会拒绝未来或明显陈旧的快照。CINS 仅在 Feodo 不能提供有效覆盖时请求；单个来源失败不会终止评估。同 IP 全评估、Geo、风险和密钥查询合并并发请求，各供应商独立限并发和失败冷却。全局情报有固定缓存保护下载间隔；地址查询使用 Set、`/24` 计数和预编译前缀区间索引，避免每个 IP 重扫上万条地址。目标 IP 不发送给公共名单服务；IPQuery、组织与配置风险接口会接收目标地址。

分类和配置风险结果最多缓存 24 小时／1 小时；ipapi.is 最多 1 小时，IPQuery 与 Proxycheck 最多 15 分钟。纯净度结果最多缓存 15 分钟，有限评估、证据不足或来源失败时 1 分钟，并以已检查来源最早的失效时间进一步缩短；浏览器使用同样的动态刷新周期，包括手工查询。有旧结果时刷新失败会保留显示并在一分钟内重试。评分前重新检查来源时效，等待其他请求期间过期的分类、风险和邻居证据退回未知，其他独立来源继续有效。模型缓存修订、配置和凭据摘要参与缓存隔离。缓存是有界的实例／Cloudflare Cache API 缓存，不是跨所有边缘节点的全局配额；流量增加时应按第三方实际额度配置套餐及现有 WAF 限流。

本地前缀每 6 小时刷新，失败冷却 1 小时并使用尚有效的快照；每次使用重新检查失效时间，过期数据不贡献分类。快照包含 SHA-256、预编译匹配索引和来源；`pnpm purity:update-data` 在发布前更新随代码携带的数据。获取时间 `fetchedAt` 与源发布时间 `updatedAt` 分开，未提供发布时间时保持 null；页面显示 live / snapshot、可用 / 过期 / 不支持等状态。

`/api/health` 的 `providers.purity=true` 表示本地评估能力常驻，`purity` 提供模型版本与实际配置的增强项；`providers.risk` 仍表示是否配置外部风险服务。所有关键字段在 OpenAPI 中定义，私网与非法地址在联系上游前拒绝。

`node scripts/purity-smoke.mjs` 使用构建后的 EdgeOne API 检查真实默认数据源，验收记录见 `docs/verification.md`。测试用于验证确定性行为与数据完整性，不是评分准确率的统计证明。
