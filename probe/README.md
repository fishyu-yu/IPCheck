# 远程探针与权威 DNS 采集协议 v1

本文件定义 ICMP、路由追踪和权威 DNS 观测所需的外部服务。仓库已实现边缘调用端与界面，**不包含探针或采集服务器实现**。未配置真实服务时明确返回不支持。

## 服务与认证

协调服务必须部署在固定的 HTTPS 地址。仅在服务端设置 `PROBE_URL` 与高强度随机 `PROBE_SECRET`。每次请求携带 `Authorization: Bearer <PROBE_SECRET>`；服务端用恒定时间比较认证信息，未通过认证时不得解析 DNS 或启动进程。

尽可能限制服务入口，定期轮换密钥，并在协调端实施全局额度、重放防护与并发控制。探针可部署在 Linux VPS 或容器内，使用最低权限；需要 ICMP socket 时只授予必要的 `CAP_NET_RAW`，不使用特权容器。节点标注的地理位置必须对应实际运行位置。

## 请求格式

所有接口接收 JSON，最大 2 KB。边缘端生成 UUID `requestId`，提供已验证的 `targetIps`；探针仍须独立校验，不能盲目信任传入地址。

```json
{
  "version": 1,
  "requestId": "<UUID>",
  "host": "example.com",
  "targetIps": ["<已验证的公网地址>"],
  "timeoutMs": 3000,
  "node": "sin"
}
```

| 接口                     | 额外字段                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| `POST /probe/ping`       | `mode: "icmp" \| "http"`、`count: 1`、`protocol: "http" \| "https"` |
| `POST /probe/tcp`        | 经过验证的整数 `port`                                               |
| `POST /probe/traceroute` | `maxHops: 20`，硬上限为 30                                          |

单区域请求可省略 `node`。多区域节点标识为 `sin / hkg / nrt / lax / fra / lhr`，分别对应新加坡、香港、东京、洛杉矶、法兰克福与伦敦。

协调服务应在 4.5 秒内返回，包含排队时间。每个节点限制并发（建议 2），每次探测只有一个目标，且必须限制次数与总预算。离线节点返回 503，不用其他位置的结果冒充该节点。

## 响应格式

Ping / TCP 响应只填写实际测得的字段：

```typescript
{
  success: boolean;
  latency?: number;   // ICMP 往返时间或 TCP 建连耗时，单位毫秒
  totalTime?: number; // HTTP HEAD 总耗时，单位毫秒
  status?: number;    // 实际 HTTP 状态码
  server?: string;    // 实际 Server 响应头，最多 256 字符
  targetIp?: string;  // 实际连接的公网 IP
  message?: string;   // 最多 500 字符，不含命令转储或密钥
}
```

路由追踪响应：

```typescript
{
  hops: Array<{
    hop: number;
    ip: string | null;
    hostname: string | null;
    asn: number | null;
    country: string | null;
    latency: number | null;
  }>;
}
```

超时节点使用 `null`，不能用 0 表示测量结果。路由中间节点可能出现私有地址，可显示，但不得作为后续扫描目标。ASN 与国家信息必须来自真实数据源。因为测量发生在远程服务，边缘端将这些结果标记为数据源检测。

## 目标校验要求

1. 只接受主机名或 IP，不接受任意 URL、路径或命令。执行与 `edge/core/security.ts` 等价的严格验证。
2. 同时解析 A 和 AAAA，校验所有解析地址及传入的 `targetIps`。拒绝私网、元数据地址、混合公网/内网答案与解析失败。
3. 选定地址必须属于校验后的列表。连接 IP 字面量，不允许网络库再次解析主机名。
4. HTTPS 使用能分别设置连接地址与 TLS `serverName` 的传输实现，按原始域名验证证书，禁止关闭证书验证，禁止自动跟随重定向。
5. TCP 独立执行端口允许列表。HTTP 仅允许 80 / 443 端口的 `HEAD /`，不返回正文。
6. ICMP 限制一次请求及报文大小；路由追踪默认最多 20 跳，每跳与整体都设超时。不得由浏览器传入系统命令参数。
7. 优先使用 ICMP / socket 库。必须调用系统工具时，使用可执行文件绝对路径、固定参数数组和 `shell: false`，只传入已验证的 IP 字面量与数字参数，并在超时后终止进程。不得拼接 shell 命令。
8. 默认不持久记录目标与 IP；聚合指标避免保留完整地址。公网开放前必须实现认证、额度与重放防护。

## 权威 DNS 采集服务

将测试子域名（例如 `test.your-domain.example`）委派给自建权威 DNS，并为随机 UUID 主机名提供无重定向的通配 HTTPS 服务。调用公共 DoH 不能代替权威 DNS 观测。

配置 `DNS_COLLECTOR_URL`、`DNS_COLLECTOR_SECRET`、`DNS_TEST_DOMAIN`。边缘端的 `RemoteDnsProbeProvider` 使用固定 HTTPS 地址和 Bearer 认证。

### 创建会话：`POST /sessions`

```typescript
// 请求
{
  id: UUID;
  hostname: `${UUID}.${DNS_TEST_DOMAIN}`;
  ttlSeconds: 120;
}
// 响应
{
  token: string;
  expiresAt: string; // ISO 日期时间
}
```

令牌应至少包含 128 位密码学随机熵；调用端接受 16–512 字符。服务端将令牌绑定会话并强制执行过期。只记录已知且未过期 UUID 对应的递归解析器来源地址；ASN / 国家信息须来自可靠数据源。不能把 HTTP 调用者地址或 ECS 提示当成实际观测到的解析器地址。

### 获取结果：`POST /results`

```typescript
// 请求：边缘端持有 Bearer 密钥，浏览器只提交会话令牌
{
  id: UUID;
  token: string;
}
// 响应
{
  complete: boolean;
  resolvers: Array<{
    ip: string;
    asn: number | null;
    country: string | null;
    organization: string | null;
  }>;
}
```

会话最长 120 秒，到期清除数据；最多返回 50 个解析器。拒绝枚举、过期或未知会话以及错误令牌。空结果表示无法判断；非空结果也仅代表观测，不能直接断言发生泄露。浏览器最多轮询五次。网站 CSP 只应放行相应 `*.DNS_TEST_DOMAIN` 的 HTTPS 请求。

## 上线前验收

- 缺少或错误认证：返回 401，不进行目标网络访问。
- 元数据、私网、映射地址、DNS 重绑定或重定向目标：连接前拒绝。
- 命令特殊字符、换行、非标准数字 IP：拒绝。
- 可达公网测试目标：返回真实测量值与实际目标 IP。
- 无响应目标：在设定时间内超时，不伪造为零延迟。
- 离线区域：返回 503，不使用其他区域结果替代。
- DNS 会话：随机域名产生匹配的权威查询记录，仅正确令牌能读取，过期后清除。
