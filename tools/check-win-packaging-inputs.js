const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const releaseDir = path.join(projectRoot, 'release');

const requiredPaths = [
  { path: path.join(projectRoot, 'out'), type: 'dir', label: '构建输出目录 out/' },
  { path: path.join(projectRoot, 'out', 'main', 'main.js'), type: 'file', label: '主进程产物 out/main/main.js' },
  { path: path.join(projectRoot, 'out', 'renderer', 'index.html'), type: 'file', label: '渲染进程产物 out/renderer/index.html' },
  { path: path.join(projectRoot, 'out', 'renderer', 'bundle.js'), type: 'file', label: '渲染进程产物 out/renderer/bundle.js' },
  { path: path.join(projectRoot, 'resources', 'ocr'), type: 'dir', label: 'OCR 资源目录 resources/ocr' }
];

function checkRequiredPaths() {
  const errors = [];

  for (const item of requiredPaths) {
    let stat;
    try {
      stat = fs.statSync(item.path);
    } catch (error) {
      errors.push(`缺失 ${item.label}: ${item.path}`);
      continue;
    }

    const isValid = item.type === 'dir' ? stat.isDirectory() : stat.isFile();
    if (!isValid) {
      errors.push(`${item.label} 类型不正确: ${item.path}`);
    }
  }

  return errors;
}

function checkReleaseWritable() {
  try {
    fs.mkdirSync(releaseDir, { recursive: true });
  } catch (error) {
    return [`无法创建 release 目录: ${releaseDir}\n原因: ${error.message}`];
  }

  const probeFile = path.join(releaseDir, '.write-test.tmp');
  try {
    fs.writeFileSync(probeFile, 'ok', 'utf8');
    fs.unlinkSync(probeFile);
    return [];
  } catch (error) {
    return [`release 目录不可写: ${releaseDir}\n原因: ${error.message}`];
  }
}

function run() {
  const errors = [...checkRequiredPaths(), ...checkReleaseWritable()];

  if (errors.length > 0) {
    console.error('[build:win] Windows 安装包前置校验失败:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error('请先执行 npm run build 并修复上述问题后重试。');
    process.exit(1);
  }

  console.log('[build:win] 前置校验通过。');
}

run();
