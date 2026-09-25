import { site } from '../src/config/site';
import { payloadName, payloadSchemas } from './schemas';
export const apiRoutes = [
  ['get', '/api/ip', 'Visitor IP'],
  ['get', '/api/ip/{ip}', 'IP lookup'],
  ['get', '/api/asn/{asn}', 'ASN lookup'],
  ['get', '/api/risk/{ip}', 'Risk analysis'],
  ['get', '/api/ping', 'Browser to edge echo'],
  ['post', '/api/ping', 'HTTP or ICMP probe'],
  ['post', '/api/http-ping', 'HTTP HEAD probe'],
  ['post', '/api/tcping', 'TCP connection probe'],
  ['get', '/api/dns', 'DNS lookup'],
  ['get', '/api/reverse', 'Reverse DNS'],
  ['post', '/api/global', 'Global probe'],
  ['post', '/api/trace', 'Traceroute'],
  ['post', '/api/dns-leak', 'Start DNS collector session'],
  ['post', '/api/dns-leak/results', 'Read DNS collector session'],
  ['get', '/api/health', 'Runtime capabilities'],
] as const;
export function openApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [method, path, summary] of apiRoutes) {
    const parameters: unknown[] = [];
    for (const match of path.matchAll(/\{(\w+)\}/g))
      parameters.push({ name: match[1], in: 'path', required: true, schema: { type: 'string' } });
    if (path === '/api/dns')
      parameters.push(
        { name: 'name', in: 'query', required: true, schema: { type: 'string' } },
        {
          name: 'type',
          in: 'query',
          schema: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA'], default: 'A' },
        },
      );
    if (path === '/api/reverse')
      parameters.push({ name: 'ip', in: 'query', required: true, schema: { type: 'string' } });
    const properties = path.endsWith('/results')
      ? { id: { type: 'string', format: 'uuid' }, token: { type: 'string' } }
      : {
          host: { type: 'string' },
          port: { type: 'integer', default: 443 },
          mode: { type: 'string', enum: ['http', 'icmp'] },
          protocol: { type: 'string', enum: ['http', 'https'] },
          node: { type: 'string', enum: ['sin', 'hkg', 'nrt', 'lax', 'fra', 'lhr'] },
        };
    const operation: Record<string, unknown> = {
      summary,
      parameters,
      responses: {
        '200': {
          description: 'Result; unsupported and partial evidence are explicitly marked',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Success' },
                  {
                    type: 'object',
                    properties: { data: { $ref: '#/components/schemas/' + payloadName(path, method) } },
                  },
                ],
              },
            },
          },
        },
        ...Object.fromEntries(
          [
            ['400', 'Invalid input'],
            ['403', 'Disallowed origin or target'],
            ['429', 'Rate limit exceeded'],
            ['502', 'Upstream unavailable'],
          ].map(([code, description]) => [
            code,
            {
              description,
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          ]),
        ),
      },
    };
    if (method === 'post')
      operation.requestBody = {
        required: path !== '/api/dns-leak',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties,
              required: path.endsWith('/results')
                ? ['id', 'token']
                : path === '/api/dns-leak'
                  ? []
                  : ['host'],
            },
          },
        },
      };
    paths[path] ??= {};
    paths[path][method] = operation;
  }
  return {
    openapi: '3.1.0',
    info: {
      title: site.name + ' API',
      version: '1.0.0',
      description:
        'Same-origin browser API; CLI returns JSON. Probes: 10/min/IP. Queries: 60/min/IP. Missing evidence never means safe.',
    },
    paths,
    components: {
      schemas: {
        ...payloadSchemas,
        Success: {
          type: 'object',
          required: ['success', 'data', 'meta'],
          properties: {
            success: { const: true },
            data: { oneOf: [{ type: 'object' }, { type: 'array', items: { type: 'object' } }] },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                edge: { type: 'string' },
                source: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { const: false },
            error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
          },
        },
      },
    },
  };
}
