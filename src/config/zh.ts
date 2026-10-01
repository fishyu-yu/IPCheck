// English keys also serve as the fallback language. Translate presentation text only.
export const zh: Record<string, string> = Object.fromEntries(
  `
Unknown|未知
Low Risk|低风险
Moderate Risk|中等风险
High Risk|高风险
Spam|垃圾信息
Anonymous|匿名网络
Platform bindings|平台原生限流
Per-isolate fallback; production WAF rate rules required|当前使用实例级限流；生产环境需配置 WAF 限流规则
Weighted evidence model v1. Missing signals are not negative findings. Hosting has zero weight to avoid double-counting datacenter. Conflicts use the highest reported severity and remain visible.|证据加权模型 v1：缺失信号不视为无风险。托管网络权重为零，以免与数据中心重复计分；来源冲突时采用较高风险值，并保留全部结果。
Latency test failed|延迟测试失败
· confidence|· 置信度
Invalid IPv4 or IPv6|请输入有效的 IPv4 或 IPv6 地址
Invalid ASN|请输入有效的 ASN
Enter an IP address or a fully qualified hostname without a scheme, path, or port|请输入 IP 地址或完整域名，不要包含协议、路径或端口
Every resolved address must be public; mixed public/private answers are rejected|全部解析地址都必须为公网地址，不允许混合内网和公网地址
Service endpoints must be HTTPS URLs without credentials or query strings|服务地址必须使用 HTTPS，且不能包含凭据或查询参数
Empty upstream response|上游返回了空响应
Upstream response exceeds size limit|上游响应超过大小限制
Content-Type must be application/json|请求类型必须为 application/json
JSON body required|请求需要包含 JSON 数据
Maximum body size is 2 KB|请求数据不能超过 2 KB
Invalid JSON|JSON 格式无效
HTTP probing unavailable on this runtime|当前环境无法执行 HTTP 探测
unknown|未知
Not checked|未检测
Unsupported|不支持
Partial data|部分数据
Run test|开始检测
Running…|检测中…
Run|开始
Tool|工具
Workspace|工作台
Overview|概览
All tools|全部工具
IP intelligence|IP 信息
IP INTELLIGENCE|IP 信息
IP Lookup|IP 查询
ASN Lookup|ASN 查询
Risk Analysis|风险分析
Network|网络
Ping|连通性检测
TCP Ping|TCP 检测
Global Ping|全球节点检测
Traceroute|路由追踪
DNS Lookup|DNS 查询
Reverse DNS|反向 DNS
Latency Test|延迟测试
Privacy|隐私
PRIVACY|隐私检测
Environment|浏览器环境
Fingerprint|浏览器指纹
WebRTC Leak|WebRTC 泄露
DNS Leak|DNS 泄露
Developer|开发者
DEVELOPER|开发者
API Reference|API 文档
System Status|系统状态
System status|系统状态
NETWORK WORKSPACE|网络工作台
PRIVACY / LOCAL ONLY|隐私 · 仅在本地
Personal workspace|个人工作台
Network diagnostics|网络诊断
Private by design|隐私优先
Browser data stays with you.|浏览器数据仅留在本地
Close navigation|关闭导航
Main navigation|主导航
Close menu|关闭菜单
Open menu|打开菜单
Connecting|连接中
Toggle color theme|切换明暗主题
API help|API 帮助
Built for transparency|每项结果，有据可查
IP & Network Intelligence|IP 与网络洞察
Your network, in focus.|看清你的网络。
A clear view of your connection, performance, and privacy.|连接、性能与隐私，一目了然。
Refresh analysis|刷新检测
YOUR PUBLIC IP|你的公网 IP
AWAITING EDGE|等待连接
Not available locally|本地无法获取
Location unknown|位置未知
ASN unknown|ASN 未知
Network unknown|网络未知
Connect through a supported edge deployment|请通过已部署的站点访问
CONNECTED WORLD / 001|连接世界
Location|地理位置
Geolocation is approximate|地理位置为近似值
Waiting for network metadata|等待网络信息
Risk level|风险等级
Provider evidence required|等待数据源提供证据
Local-first|本地优先
Fingerprint stays in your browser|指纹数据仅保留在浏览器
GEO|位置
RISK|风险
BROWSER|浏览器
Network information|网络信息
Your connection at a glance|了解当前连接
Edge metadata|边缘节点信息
IP address|IP 地址
IP version|IP 版本
ISP / Organization|运营商 / 组织
Autonomous system|自治系统
Network type|网络类型
Edge POP|边缘节点
Timezone|时区
Explore IP intelligence|查看 IP 详情
Connection latency|连接延迟
Your browser → current edge · HTTP round trip|浏览器 → 当前边缘节点 · HTTP 往返
Average RTT|平均往返延迟
Not measured|尚未测量
MIN|最低
JITTER|抖动
Browser environment|浏览器环境
What your browser shares|浏览器可见信息
Platform|平台
Language|语言
Languages|语言偏好
Screen|屏幕
CPU threads|CPU 线程数
Unsupported by browser|浏览器不支持
Collected locally. Never uploaded.|仅在本地采集，不会上传。
View browser environment|查看浏览器详情
No tracking scripts. No fabricated results. Every finding has a source.|无追踪脚本，结果真实，来源可查。
Explore all tools|探索全部工具
Real Detection|实时检测
Provider Detection|数据源检测
Browser-side Detection|浏览器检测
Estimated / Unsupported|估算 / 不支持
Loading results|正在加载结果
Copy failed|复制失败
Copied|已复制
Copy to clipboard|复制到剪贴板
Copy unavailable; select text manually|无法复制，请手动选择文本
Copy|复制
Page not found|页面不存在
Back to overview|返回概览
Risk analysis|风险分析
Evidence, not assumptions|依据证据评估
of|/
signals checked|项已检测
Lower score = lower observed risk|分数越低，已观测风险越低
Detected|已检测到
Not detected|未检测到
confidence|置信度
not supplied|未提供
Proxy|代理
Hosting|托管网络
Bot|自动化流量
Abuse|滥用记录
Fraud|欺诈风险
Blacklist|黑名单
RecentAbuse|近期滥用
Recentabuse|近期滥用
Datacenter|数据中心
This score is a weighted model, not an absolute safety verdict. Configure a risk provider to obtain evidence.|评分基于证据加权计算，并非绝对安全结论。配置风险数据源后可获取证据。
Conflicting Data:|数据存在冲突：
. All provider findings are retained.|。所有数据源结果均已保留。
Partial data. Unchecked signals can change the score; a low score is not an assurance of safety.|数据不完整。未检测的信号可能影响评分，低分不代表安全保证。
Geography, network ownership, and the evidence behind each result.|查询地理位置、网络归属与数据来源。
Explore an autonomous system and its announced networks.|查看自治系统及其宣告的网络前缀。
A transparent risk model. Missing evidence is never treated as safe.|风险依据清晰可查，缺少证据不等于安全。
IPv4 / IPv6 address|IPv4 / IPv6 地址
Enter IPv4 / IPv6|输入 IPv4 / IPv6 地址
Look up|查询
Source: RIPEstat. Prefixes reflect observed BGP announcements.|来源：RIPEstat。前缀反映观测到的 BGP 路由宣告。
Queries are sent to configured providers. Results can be incomplete or differ between sources.|查询会发送至已配置的数据源，结果可能不完整或存在差异。
Current public IP unavailable|暂时无法获取当前公网 IP
Basic information|基本信息
Country|国家 / 地区
Country code|国家 / 地区代码
Region|区域
City|城市
Postal code|邮政编码
Latitude|纬度
Longitude|经度
ASN name|ASN 名称
Organization|组织
Network range / prefix|网络范围 / 前缀
Hosting provider|托管服务商
IP type|IP 类型
User agent|用户代理
Sources & confidence|数据来源与置信度
Geolocation is an estimate from provider records, not precise device location. Unknown confidence means the provider supplied no confidence metric.|地理位置由数据源记录估算，并非设备精确位置。置信度未知表示数据源未提供该指标。
No provider data|暂无数据源结果
Prefix count|前缀数量
Peering / upstream|对等互联 / 上游
Source|来源
Data availability|数据可用性
Prefixes are announcements observed by RIPE RIS, not a complete ownership inventory. Country and upstream information remain Unknown without a reliable provider.|前缀来自 RIPE RIS 观测，并非完整的网络归属清单。缺少可靠来源时，国家和上游信息显示为未知。
IPv4 prefixes|IPv4 前缀
IPv6 prefixes|IPv6 前缀
No prefix data returned|暂无前缀数据
Explore a network|探索一个网络
Enter an ASN to retrieve organization and prefix data from RIPEstat.|输入 ASN，从 RIPEstat 获取组织与网络前缀。
A readable inventory of what your browser exposes to this page.|了解当前页面能够读取的浏览器信息。
These values are self-reported and may be reduced or spoofed. Browser and device identification are estimates. No environment payload is sent to the API.|这些值由浏览器报告，可能经过保护或修改；浏览器与设备识别仅供参考。环境信息不会上传至 API。
Yes|是
No|否
Supported|支持
Browser fingerprint|浏览器指纹
Understand your observable environment without creating a server-side identity.|了解可被识别的环境特征，不建立服务端身份。
Browser environment hash|浏览器环境摘要
Local only|仅在本地
This identifier describes the current browser environment and may change. It is not guaranteed unique and is never uploaded by this application.|该标识描述当前浏览器环境，可能变化且不保证唯一。本应用不会上传此标识。
Compute locally|在本地计算
SHA-256 of sorted observable fields. No persistent storage, canvas image extraction, or audio rendering is used.|对排序后的可观测字段计算 SHA-256，不持久化存储、不提取画布图像，也不渲染音频。
Observable fields|可观测字段
Hashing unavailable. A secure context and Web Crypto support are required.|无法计算摘要，需要 HTTPS 安全环境及 Web Crypto 支持。
WebRTC leak test|WebRTC 泄露检测
Inspect ICE candidates and compare observable public addresses with your HTTP connection.|查看 ICE 候选地址，并与 HTTP 连接的公网地址比较。
ICE candidate discovery|ICE 候选地址发现
Starting this test contacts Cloudflare’s public STUN service (stun.cloudflare.com:3478), which sees your public network address. Candidate data stays in this browser. No camera or microphone permission is requested.|检测将连接 Cloudflare 公共 STUN 服务（stun.cloudflare.com:3478），该服务会获知你的公网地址。候选数据留在本地，不请求摄像头或麦克风权限。
Start WebRTC test|开始 WebRTC 检测
Cancel|取消
HTTP public IP|HTTP 公网 IP
Comparison|对比结果
Local address protection|本地地址保护
Local IP protected by browser / mDNS|浏览器 / mDNS 已保护本地 IP
Relay candidates|中继候选地址
Require TURN configuration; no public TURN credentials bundled|需要配置 TURN，应用不附带公共 TURN 凭据
Unable to determine:|无法判断：
WebRTC candidates|WebRTC 候选地址
Type|类型
Address|地址
Protocol|协议
Port|端口
Host Candidate|主机候选地址
Server Reflexive Candidate|服务器反射候选地址
Relay Candidate|中继候选地址
No candidates observed|未观测到候选地址
No test performed|尚未进行检测
Missing or hidden candidates cannot be interpreted as No Leak.|候选地址缺失或隐藏，不能说明没有泄露。
DNS leak test|DNS 泄露检测
Real resolver observation requires an authoritative DNS collector.|通过权威 DNS 采集服务，观测实际使用的解析器。
Authoritative resolver test|权威 DNS 解析器检测
Collector configured|已配置采集服务
Not configured|未配置
Starting this test causes a unique random subdomain to resolve. The configured collector temporarily sees recursive resolver addresses.|检测会解析唯一的随机子域名，已配置的采集服务会短暂获知递归解析器地址。
DNS Leak advanced test requires DNS collector configuration.|DNS 泄露检测需要配置 DNS 采集服务。
Create a random UUID under your delegated test domain.|在测试域名下生成随机子域名。
Request that hostname from this browser.|由当前浏览器请求该域名。
Collect resolver source IPs at the authoritative DNS server.|由权威 DNS 服务观测解析器来源 IP。
Read authenticated, short-lived results for this session.|读取经过验证、短期有效的检测结果。
Start DNS leak test|开始 DNS 泄露检测
Collector complete|采集完成
Partial / awaiting collector|等待采集 / 部分结果
Observed resolvers|已观测到的解析器
Resolver IP|解析器 IP
Unable to determine|无法判断
A regular DNS-over-HTTPS lookup does not reveal which recursive resolver your browser used.|普通的 DNS-over-HTTPS 查询无法判断浏览器实际使用了哪个递归解析器。
Your network toolkit|你的网络工具箱
Focused diagnostics, clear limitations, and evidence you can inspect.|按需检测，了解能力边界，查看真实结果。
A transparent API|开放、清晰的 API
Standard JSON. Explicit sources. The same endpoints that power this workspace.|标准 JSON，来源明确，与本站使用相同接口。
Browser requests are same-origin by default. CLI clients can call the endpoints directly. Queries: 60/min/IP; active probes: 10/min/IP. Fingerprint, environment, and WebRTC candidates have no upload endpoint.|浏览器默认仅允许同源请求，命令行可直接调用。每个 IP 每分钟允许 60 次查询、10 次主动探测。浏览器指纹、环境与 WebRTC 候选地址不提供上传接口。
Lookup endpoints|查询接口
Current client address|当前客户端地址
Risk evidence|风险证据
DNS records|DNS 记录
PTR lookup|PTR 查询
Probe endpoints|探测接口
Uncached edge echo|无缓存的边缘节点响应
HTTP HEAD timing|HTTP HEAD 耗时
TCP connection timing|TCP 连接耗时
HTTP / remote ICMP|HTTP / 远程 ICMP
Remote multi-node ICMP|远程多节点 ICMP
Remote traceroute|远程路由追踪
Capabilities & providers|能力与数据源
Privacy architecture|隐私说明
does not store browser fingerprints, WebRTC candidates, or query history. Provider lookups disclose the queried IP to the configured provider. IP / ASN / risk provider results may be cached for 24h / 24h / 1h respectively. Rate counters are short-lived. Hosting platforms and third-party providers have their own retention policies.|不存储浏览器指纹、WebRTC 候选地址或查询历史。查询的 IP 会发送至已配置的数据源；IP、ASN、风险结果可能分别缓存 24 小时、24 小时和 1 小时。限流计数短期保存，托管平台与第三方遵循各自的数据保留政策。
Risk is a local scoring model over provider evidence. A score of zero with partial coverage is not proof of safety. Unsupported tests report limitations, never invented measurements.|风险评分由数据源证据在本地计算。覆盖不完整时，零分也不代表安全。不支持的检测会说明原因，不会编造数据。
Live capabilities reported by the runtime handling your request.|查看当前服务的实时能力与数据源配置。
API responding|API 响应正常
Available|可用
Not configured / Unsupported|未配置 / 不支持
Provider configuration|数据源配置
Configured|已配置
Configured does not mean the upstream is reachable. Individual tests report real failures and timeouts.|已配置不代表上游服务可达。每次检测都会如实报告失败或超时。
10 uncached HTTP requests from this browser to the current edge. This is not ICMP.|从浏览器向当前边缘节点发送 10 次无缓存 HTTP 请求，测量往返延迟。
Browser → edge|浏览器 → 边缘节点
Measure latency|测量延迟
Stop|停止
/ 10 requests|/ 10 次请求
min|最低
average|平均
median|中位数
p95|P95
max|最高
jitter|抖动
RTT includes browser scheduling and HTTP overhead. P95 uses nearest rank. Jitter is the mean absolute difference between consecutive successful RTT samples.|往返延迟包含浏览器调度与 HTTP 开销。P95 使用最近秩法；抖动为相邻成功样本延迟差的绝对值均值。
Measure from the edge or an authenticated probe. Every mode describes what it actually measures.|从边缘节点或已认证的探针发起检测，了解目标连通性。
Target hostname / IP|目标域名 / IP
Mode|模式
TCP connection|TCP 连接
ICMP echo|ICMP 回显
Single test|单次检测
Continuous test · 10|连续检测 · 10 次
completed|次已完成
One request at a time · minimum 6.5 s between probes · maximum 10 / 120 s per run · 10 active requests/min/IP shared across tools.|每次仅发送一个请求，间隔至少 6.5 秒；每轮最多 10 次、120 秒。所有工具共享每 IP 每分钟 10 次的主动探测限额。
TCP Ping unavailable on this edge provider|当前边缘平台不支持 TCP 检测
ICMP requires a configured Probe Agent|ICMP 检测需要配置远程探针
Active probes are unavailable|主动探测不可用
HTTP measures a HEAD request to /. Redirects are reported, never followed. HTTPS hostnames require a remote agent that supports IP pinning and TLS hostname verification; unsupported runtimes return a clear explanation.|HTTP 测量对根路径的 HEAD 请求，不跟随重定向。HTTPS 域名需要支持固定目标 IP 和 TLS 主机名验证的远程探针；不支持时会明确说明。
Probe results|探测结果
Measuring|测量中
Ready|准备就绪
Ready when you are|准备开始检测
Enter a public target. No synthetic measurements are shown.|输入公网域名或 IP，获取真实测量结果。
Result|结果
Time|耗时
Target IP|目标 IP
Connected|已连接
Failed|失败
Reported Server header:|服务器响应头：
. DNS / connect / TTFB breakdown: Unsupported by runtime.|。当前环境不支持分项统计 DNS、连接和首字节耗时。
Query configurable DNS-over-HTTPS resolvers. These are DNS records, not a DNS leak test.|使用 DNS-over-HTTPS 查询域名记录；此工具不检测 DNS 泄露。
Domain|域名
Record type|记录类型
Query DNS|查询 DNS
Resolver:|解析器：
· DNS status|· DNS 状态
Name|名称
Value|值
No answers returned|未返回匹配记录
The resolver returned no matching records. This is not a privacy verdict.|解析器未返回匹配记录，该结果不用于判断隐私安全。
Inspect a DNS record|查看 DNS 记录
Select a record type and submit a domain to see real resolver answers.|选择记录类型并输入域名，查看解析结果。
Singapore|新加坡
Hong Kong|香港
Tokyo|东京
Los Angeles|洛杉矶
Frankfurt|法兰克福
London|伦敦
Hop-by-hop visibility from a real probe agent.|通过真实远程探针逐跳查看网络路径。
One target. Six possible vantage points. Only real, available agents return measurements.|从六个地区检测同一目标，仅显示可用探针的真实测量。
traceroute|路由追踪
global test|全球检测
Traceroute requires a Probe Agent.|路由追踪需要配置远程探针。
Node unavailable. Configure PROBE_URL and PROBE_SECRET to connect a coordinator.|节点不可用，请配置 PROBE_URL 和 PROBE_SECRET 连接探针服务。
Probe network|探针网络
Schematic positions · measurements only appear after a successful probe|节点位置示意 · 检测成功后显示真实测量
Six proposed probe locations; target links appear only for real successful results|六个探针位置示意，仅在检测成功后显示目标连接
Target:|目标：
(schematic)|（示意）
Status|状态
Latency|延迟
Responded|已响应
Node unavailable|节点不可用
Route hops|路由节点
Hop|跳数
Hostname|主机名
No route measured|尚未测量路由
A connected probe is required to report route hops. Browser fetch cannot perform traceroute.|路由追踪需要连接远程探针，浏览器请求无法直接执行此检测。
Probe contract|探针接口说明
Transport|传输方式
Authenticated HTTPS|已认证的 HTTPS
Authentication|认证方式
Target policy|目标策略
Resolve all addresses, validate, then pin connection IP|解析并验证全部地址，再固定连接 IP
Execution policy|执行策略
Fixed executable and arguments; never shell=true|固定可执行程序与参数，禁止 shell=true
Result source|结果来源
Provider Detection — Remote Probe Agent|数据源检测 — 远程探针
Latency samples in milliseconds|延迟样本，单位毫秒
No latency measurements yet|暂无延迟测量结果
Run a test to measure your connection|开始检测，查看连接延迟
Browser|浏览器
Browser (UA estimate)|浏览器（UA 估算）
Version (reported)|版本（浏览器报告）
Rendering engine (estimate)|渲染引擎（估算）
Operating system (UA estimate)|操作系统（UA 估算）
Device type (estimate)|设备类型（估算）
Mobile|移动设备
Desktop / Tablet|桌面 / 平板
User Agent|用户代理
Resolution|分辨率
Available resolution|可用分辨率
Pixel ratio|像素比
Color depth|色深
Locale|语言与地区
Timezone offset (minutes)|时区偏移（分钟）
Hardware|硬件
Device memory (GiB)|设备内存（GiB）
Touch support|触控支持
Touch points|触控点数
Connection type|连接类型
Effective type|有效网络类型
RTT (browser estimate, ms)|往返延迟（浏览器估算，毫秒）
Downlink (browser estimate, Mbps)|下行带宽（浏览器估算，Mbps）
Save data|节省流量模式
WebGL renderer|WebGL 渲染器
WebGL vendor|WebGL 厂商
Unavailable / protected|不可用 / 已保护
Canvas capability|画布支持
Audio capability|音频支持
Hardware concurrency|硬件并发数
Device memory|设备内存
No obvious leak detected|未检测到明显泄露
Potential leak detected|检测到潜在泄露
No comparable public ICE address or HTTP public address is available. This does not prove there is no leak.|缺少可比较的 ICE 或 HTTP 公网地址，无法据此证明没有泄露。
ICE and HTTP addresses use different IP families; a dual-stack connection cannot be judged as a mismatch.|ICE 与 HTTP 地址使用不同 IP 协议族，双栈连接不能直接判定为不一致。
A public ICE address differs from the HTTP address in the same IP family. Dual egress or VPN split routing can cause this; it is not proof of compromise.|同一 IP 协议族的 ICE 公网地址与 HTTP 地址不同。双出口或 VPN 分流可能导致这种情况，并不代表遭到入侵。
Observed public candidates match the HTTP address. This limited test cannot prove absence of all leaks.|已观测的公网候选地址与 HTTP 地址一致，但有限的检测无法排除全部泄露可能。
WebRTC is unsupported by this browser.|当前浏览器不支持 WebRTC。
Cancelled|已取消
Local development|本地开发
tcpSocket|TCP 连接
httpProbe|HTTP 探测
icmp|ICMP 探测
dnsCollector|DNS 采集服务
geo|地理位置
risk|风险数据
remoteProbe|远程探针
Low|低风险
Medium|中等风险
High|高风险
Very High|高风险
Residential|住宅网络
Business|企业网络
Mobile network|移动网络
Non-public address: geolocation and risk providers were not contacted|非公网地址，未向地理位置与风险数据源发送请求
No geolocation provider returned data|地理位置数据源未返回结果
Public client IP is unavailable in this local runtime. Deploy to an edge platform or set DEV_PUBLIC_IP for development.|本地运行时无法获取客户端公网 IP。请部署到边缘平台，或在开发环境设置 DEV_PUBLIC_IP。
No risk provider configured. Missing evidence does not mean safe.|未配置风险数据源，缺少证据不代表安全。
Organization data unavailable|组织数据不可用
Prefix data unavailable|前缀数据不可用
Registry data unavailable|注册数据不可用
Only public unicast IP addresses are allowed|仅允许公网单播 IP 地址
Local and special-use hostnames are not allowed|不允许本地及特殊用途主机名
The target has no public A or AAAA records|目标没有公网 A 或 AAAA 记录
Port is not in the deployment allowlist|此端口不在允许检测的列表中
Upstream service is unavailable or rate limited|上游服务不可用或已限流
All configured DNS-over-HTTPS providers failed|所有 DNS-over-HTTPS 数据源均请求失败
ICMP requires an authenticated Probe Agent|ICMP 检测需要已认证的远程探针
Traceroute requires an authenticated Probe Agent|路由追踪需要已认证的远程探针
Probe Agent is not configured|未配置远程探针
HTTP probing unavailable on this runtime|当前运行时不支持 HTTP 探测
Cross-origin requests are not allowed|不允许跨域请求
Active probes are disabled by this deployment|当前部署已禁用主动探测
Only one active probe request per client is allowed|每个客户端同时只能运行一项主动探测
Risk lookup requires a public address|风险查询需要公网地址
Node unavailable or timed out|节点不可用或请求超时
API route not found|API 路径不存在
The operation failed or timed out. No detection result is available.|操作失败或超时，暂无检测结果。
DNS collector is not configured|未配置 DNS 采集服务
Probe failed|探测失败
Failed to fetch|网络连接失败，请稍后重试
The operation was aborted due to timeout|请求超时，请稍后重试
NetworkError when attempting to fetch resource.|网络请求失败，请稍后重试
Public address required|需要公网地址
Language follows your browser|语言跟随浏览器设置
Skip to content|跳至主要内容
Source code|查看源码
DEV_PUBLIC_IP is an explicitly configured development address, not an automatically detected visitor address.|DEV_PUBLIC_IP 是手动配置的开发测试地址，并非自动检测到的访客地址。
countryCode|国家或地区代码
country|国家或地区
region|省份或地区
city|城市
postal|邮政编码
latitude|纬度
longitude|经度
timezone|时区
organization|所属组织
isp|网络服务商
asn|自治系统编号
asnName|自治系统名称
prefix|网络前缀
type|网络类型
reverseDns|反向 DNS
hostingProvider|托管服务商
partial|数据完整性
warnings|提示
vpn|VPN
proxy|代理
tor|Tor
hosting|托管网络
datacenter|数据中心
bot|机器人
abuse|滥用记录
spam|垃圾邮件
blacklist|黑名单
anonymous|匿名网络
Mobile network|移动网络
Education|教育机构
Government|政府机构
bluetooth|蓝牙
cellular|蜂窝网络
ethernet|以太网
wifi|无线网络
wimax|WiMAX
none|无连接
other|其他
unknown|未知
Prefixes|网络前缀
Registry|注册信息
Invalid|输入格式不正确
Required|请填写此项
Expected integer, received float|请输入整数
Every resolved address must be public; mixed public/private answers are rejected|所有解析地址均须为公网地址，不接受混合公网与内网的解析结果
Service endpoints must be HTTPS URLs without credentials or query strings|服务地址必须使用 HTTPS，且不包含凭证或查询参数
Empty upstream response|上游服务返回了空响应
Network diagnostics with clear sources and privacy-first browser tools.|来源清晰、注重隐私的网络诊断工具。
`
    .trim()
    .split('\n')
    .map((line) => {
      const separator = line.indexOf('|');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
