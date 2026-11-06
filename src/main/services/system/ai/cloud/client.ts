import * as fs from 'fs';
import * as path from 'path';
import type { IncomingHttpHeaders } from 'http';
import * as https from 'https';
import { AIProvider } from '../../../../../shared/types/ai.types';
import { getDefaultBaseUrl } from '../../../../../shared/utils/ai';

export async function postRequest(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeout: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);

    const options: https.RequestOptions = {
      hostname,
      path: pathname + search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          let errorMsg = `API Error: ${res.statusCode}`;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error && parsed.error.message) {
              errorMsg = parsed.error.message;
            } else if (parsed.message) {
              errorMsg = parsed.message;
            }
          } catch {
            errorMsg = `${errorMsg} ${data}`;
          }
          if (res.statusCode === 429) {
            errorMsg = `AI 服务当前繁忙，请稍后重试 (429): ${errorMsg}`;
          }
          reject(new Error(errorMsg));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function rawRequest(
  method: 'GET' | 'DELETE',
  url: string,
  headers: Record<string, string>,
  timeout: number,
): Promise<{ statusCode: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);

    const options: https.RequestOptions = {
      hostname: target.hostname,
      port: target.port ? Number(target.port) : undefined,
      protocol: target.protocol,
      path: `${target.pathname}${target.search}`,
      method,
      headers,
      timeout,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf-8'));
      });
      res.on('end', () => {
        resolve({
          statusCode: Number(res.statusCode || 0),
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.on('error', reject);
    req.end();
  });
}

async function postMultipartRequest(
  url: string,
  headers: Record<string, string>,
  fields: Array<{ name: string; value: string }>,
  file: { fieldName: string; filePath: string; contentType: string },
  timeout: number,
): Promise<unknown> {
  const boundary = `----TraeBoundary${Date.now().toString(16)}`;
  const parts: Buffer[] = [];

  for (const field of fields) {
    parts.push(Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`
      + `${field.value}\r\n`,
      'utf-8',
    ));
  }

  const filename = path.basename(file.filePath);
  parts.push(Buffer.from(
    `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="${file.fieldName}"; filename="${filename}"\r\n`
    + `Content-Type: ${file.contentType}\r\n\r\n`,
    'utf-8',
  ));
  parts.push(fs.readFileSync(file.filePath));
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'));

  const body = Buffer.concat(parts);
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const options: https.RequestOptions = {
      hostname: target.hostname,
      port: target.port ? Number(target.port) : undefined,
      protocol: target.protocol,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      timeout,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
          return;
        }

        let errorMsg = `API Error: ${res.statusCode}`;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error && parsed.error.message) {
            errorMsg = parsed.error.message;
          } else if (parsed.message) {
            errorMsg = parsed.message;
          }
        } catch {
          errorMsg = `${errorMsg} ${data}`;
        }
        reject(new Error(errorMsg));
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.txt') return 'text/plain';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.json') return 'application/json';
  if (ext === '.csv') return 'text/csv';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff';
  return 'application/octet-stream';
}

function getKimiApiBase(baseUrl: string): string {
  const normalized = String(baseUrl || getDefaultBaseUrl('kimi')).trim().replace(/\/+$/, '');
  const matched = normalized.match(/^(https?:\/\/[^/]+(?:\/v1)?)/i);
  if (!matched) {
    return `${normalized}/v1`;
  }
  return matched[1].endsWith('/v1') ? matched[1] : `${matched[1]}/v1`;
}

export function canUseKimiFileExtraction(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [
    '.pdf',
    '.doc',
    '.docx',
    '.txt',
    '.md',
    '.json',
    '.csv',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.bmp',
    '.tif',
    '.tiff',
    '.xls',
    '.xlsx',
  ].includes(ext);
}

export async function extractTextViaKimiFile(
  apiKey: string,
  baseUrl: string,
  filePath: string,
  timeoutMs: number,
): Promise<string> {
  if (!apiKey) {
    throw new Error('API Key 未配置');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  if (!canUseKimiFileExtraction(filePath)) {
    throw new Error(`Kimi 文件提取暂不支持该格式: ${path.extname(filePath).toLowerCase() || '(无扩展名)'}`);
  }

  const apiBase = getKimiApiBase(baseUrl);
  const upload = await postMultipartRequest(
    `${apiBase}/files`,
    { Authorization: `Bearer ${apiKey}` },
    [{ name: 'purpose', value: 'file-extract' }],
    { fieldName: 'file', filePath, contentType: getMimeType(filePath) },
    timeoutMs,
  ) as { id?: string };

  const fileId = String(upload?.id || '').trim();
  if (!fileId) {
    throw new Error('Kimi 文件上传成功，但未返回 fileId');
  }

  try {
    const contentResponse = await rawRequest(
      'GET',
      `${apiBase}/files/${fileId}/content`,
      { Authorization: `Bearer ${apiKey}` },
      timeoutMs,
    );
    if (contentResponse.statusCode < 200 || contentResponse.statusCode >= 300) {
      throw new Error(`Kimi 文件内容读取失败: ${contentResponse.statusCode}`);
    }
    const text = contentResponse.body.toString('utf-8').trim();
    if (!text) {
      throw new Error('Kimi 文件内容为空');
    }
    return text.length > 50000 ? `${text.slice(0, 50000)}\n...[截断]` : text;
  } finally {
    try {
      await rawRequest(
        'DELETE',
        `${apiBase}/files/${fileId}`,
        { Authorization: `Bearer ${apiKey}` },
        Math.min(timeoutMs, 15000),
      );
    } catch {
      // ignore cleanup failure
    }
  }
}

export function getEndpointUrl(baseUrl: string, provider: AIProvider): string {
  const url = baseUrl.replace(/\/+$/, '');

  if (provider === 'kimi') {
    if (url.endsWith('/v1/chat/completions')) return url;
    if (url.endsWith('/v1/chat')) return `${url}/completions`;
    if (url.endsWith('/v1')) return `${url}/chat/completions`;
    if (url.endsWith('/coding')) return `${url}/v1/chat/completions`;
    return `${url}/v1/chat/completions`;
  }

  if (provider === 'minimax') {
    if (url.endsWith('/v1/text/chatcompletion_v2')) return url;
    if (url.endsWith('/v1/text')) return `${url}/chatcompletion_v2`;
    if (url.endsWith('/v1')) return `${url}/text/chatcompletion_v2`;
    return `${url}/v1/text/chatcompletion_v2`;
  }

  if (provider === 'deepseek') {
    if (url.endsWith('/v1/chat/completions')) return url;
    if (url.endsWith('/v1/chat')) return `${url}/completions`;
    if (url.endsWith('/v1')) return `${url}/chat/completions`;
    return `${url}/v1/chat/completions`;
  }

  return url;
}

export async function executeCloudStructured(
  provider: AIProvider,
  apiKey: string,
  baseUrl: string,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  const endpoint = getEndpointUrl(baseUrl || getDefaultBaseUrl(provider), provider);
  const response = await postRequest(
    endpoint,
    { Authorization: `Bearer ${apiKey}` },
    {
      model: provider === 'kimi'
        ? 'moonshot-v1-32k'
        : provider === 'deepseek'
          ? 'deepseek-chat'
          : 'abab6.5s-chat',
      messages: [
        { role: 'system', content: '你是一个严格的结构化信息提取助手，只允许输出合法 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    },
    timeoutMs,
  ) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('云端模型未返回有效内容');
  }
  return String(content);
}
