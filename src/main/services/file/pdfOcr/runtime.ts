import * as fs from 'fs-extra';
import * as path from 'path';

export type OcrRuntimeInfo = {
  executablePath: string;
  workingDirectory: string;
  modelsPath: string;
  version: string;
  commandArgsPrefix: string[];
};

export async function resolvePaddleOcrRuntime(projectRootPath: string): Promise<OcrRuntimeInfo> {
  const envExecutablePath = String(process.env.PADDLEOCR_JSON_EXECUTABLE || '').trim();
  const envModelsPath = String(process.env.PADDLEOCR_JSON_MODELS_PATH || '').trim();
  const envWorkingDirectory = String(process.env.PADDLEOCR_JSON_WORKDIR || '').trim();
  const envVersion = String(process.env.PADDLEOCR_JSON_VERSION || '').trim();

  if (envExecutablePath) {
    const runtime: OcrRuntimeInfo = {
      executablePath: envExecutablePath,
      workingDirectory: envWorkingDirectory || path.dirname(envExecutablePath),
      modelsPath: envModelsPath || path.join(path.dirname(envExecutablePath), 'models'),
      version: envVersion || 'env-override',
      commandArgsPrefix: getEnvCommandArgsPrefix(),
    };
    await assertRuntimeUsable(runtime);
    if (!envVersion) {
      runtime.version = await buildRuntimeVersion(envExecutablePath);
    }
    return runtime;
  }

  for (const candidateDir of getBundledRuntimeCandidateDirs(projectRootPath)) {
    const executablePath = resolveBundledExecutable(candidateDir);
    if (!executablePath) {
      continue;
    }
    const runtime: OcrRuntimeInfo = {
      executablePath,
      workingDirectory: candidateDir,
      modelsPath: path.join(candidateDir, 'models'),
      version: await readRuntimeVersion(candidateDir, executablePath),
      commandArgsPrefix: [],
    };
    await assertRuntimeUsable(runtime);
    return runtime;
  }

  throw new Error(
    `未找到内置 PaddleOCR-json 运行时，请确认已将可执行文件与 models 目录放入 ${path.join('resources', 'ocr', 'PaddleOCR-json')}`,
  );
}

async function assertRuntimeUsable(runtime: OcrRuntimeInfo): Promise<void> {
  if (!(await fs.pathExists(runtime.executablePath))) {
    throw new Error(`未找到 PaddleOCR-json 可执行文件: ${runtime.executablePath}`);
  }
  if (!(await fs.pathExists(runtime.modelsPath))) {
    throw new Error(`未找到 PaddleOCR-json models 目录: ${runtime.modelsPath}`);
  }
  const modelEntries = await fs.readdir(runtime.modelsPath);
  if (modelEntries.length === 0) {
    throw new Error(`PaddleOCR-json models 目录为空: ${runtime.modelsPath}`);
  }
}

function getBundledRuntimeCandidateDirs(projectRootPath: string): string[] {
  const packagedBase = process.resourcesPath
    ? path.join(process.resourcesPath, 'ocr', 'PaddleOCR-json')
    : '';

  const cwdBase = path.join(process.cwd(), 'resources', 'ocr', 'PaddleOCR-json');

  return [packagedBase, cwdBase, path.join(projectRootPath, 'resources', 'ocr', 'PaddleOCR-json')]
    .map(candidate => candidate.trim())
    .filter(Boolean);
}

function resolveBundledExecutable(runtimeDir: string): string | null {
  const candidates = [
    path.join(runtimeDir, 'PaddleOCR-json.exe'),
    path.join(runtimeDir, 'PaddleOCR_json.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function readRuntimeVersion(runtimeDir: string, executablePath: string): Promise<string> {
  const versionFile = path.join(runtimeDir, 'version.txt');
  if (await fs.pathExists(versionFile)) {
    const version = (await fs.readFile(versionFile, 'utf-8')).trim();
    if (version) {
      return version;
    }
  }
  return await buildRuntimeVersion(executablePath);
}

async function buildRuntimeVersion(executablePath: string): Promise<string> {
  const stats = await fs.stat(executablePath);
  return `${path.basename(executablePath)}:${stats.size}:${Number(stats.mtimeMs)}`;
}

function getEnvCommandArgsPrefix(): string[] {
  const raw = String(process.env.PADDLEOCR_JSON_EXECUTABLE_ARGS || '').trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('参数必须为数组');
    }
    return parsed.map(item => String(item));
  } catch (error) {
    throw new Error(`解析 PADDLEOCR_JSON_EXECUTABLE_ARGS 失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

