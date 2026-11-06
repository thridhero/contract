import * as fs from 'fs';
import csvParser from 'csv-parser';
import * as iconv from 'iconv-lite';
import jschardet from 'jschardet';

function detectBomEncoding(sample: Buffer): 'utf8' | null {
  if (sample.length >= 3 && sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) return 'utf8';
  return null;
}

function scoreDecodedText(text: string, expectedTokens: string[]): number {
  let score = 0;

  for (const token of expectedTokens) {
    if (token && text.includes(token)) score += 10;
  }

  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  score -= replacementCount * 5;

  const mojibakePenaltyTokens = ['锟', '鍚', '缂', '搴', '鏁', '澶', '鑳'];
  for (const token of mojibakePenaltyTokens) {
    const count = (text.match(new RegExp(token, 'g')) || []).length;
    score -= Math.min(count, 20);
  }

  return score;
}

function guessEncoding(sample: Buffer): string {
  const bom = detectBomEncoding(sample);
  if (bom) return bom;

  const expectedTokens = ['名称', '编码', '缩写', '背景色', '序号', '数值', '备注', 'ID', 'ParentID'];

  const utf8Text = sample.toString('utf8');
  const gbkText = iconv.decode(sample, 'gbk');

  const utf8Score = scoreDecodedText(utf8Text, expectedTokens);
  const gbkScore = scoreDecodedText(gbkText, expectedTokens);

  if (utf8Score !== gbkScore) return utf8Score > gbkScore ? 'utf8' : 'gbk';

  const detection = jschardet.detect(sample);
  if (detection && detection.encoding) {
    const enc = detection.encoding.toLowerCase();
    if (enc.includes('utf-8') || enc.includes('ascii')) return 'utf8';
    if (enc.includes('gb')) return 'gbk';
  }

  return 'utf8';
}

/**
 * 通用 CSV 解析工具
 * @param filePath CSV 文件路径
 * @returns 解析后的对象数组
 */
export function parseCsv<T = any>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];

    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    // 读取前 4096 字节来推断编码
    const buffer = Buffer.alloc(4096);
    let bytesRead = 0;
    try {
      const fd = fs.openSync(filePath, 'r');
      bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
      fs.closeSync(fd);
    } catch (e) {
      return reject(e);
    }

    const sample = buffer.subarray(0, bytesRead);
    const encoding = guessEncoding(sample);

    fs.createReadStream(filePath)
      .pipe(iconv.decodeStream(encoding))
      .on('error', (error) => {
        reject(error);
      })
      // 可以根据实际情况增加配置，如 headers, separator 等
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}
