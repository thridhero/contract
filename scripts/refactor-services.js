const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const testsDir = path.join(__dirname, '../tests');
const servicesDir = path.join(__dirname, '../src/main/services');

const groups = {
  system: [
    'AIService.ts',
    'BackupSchedulerService.ts',
    'BackupService.ts',
    'BootstrapService.ts',
    'ConfigService.ts',
    'DatabaseService.ts',
    'ImportTaskService.ts',
    'TrashAutoPurgeService.ts',
    'librarySchemaMigration.ts',
    'database', // folder
    'librarySchemaMigration' // folder
  ],
  file: [
    'CopyAuditLogService.ts',
    'FileConversionService.ts',
    'FileCopyService.ts',
    'FileIndexerService.ts',
    'FileSearchService.ts',
    'PdfOcrService.ts',
    'ResumableBatchCopyService.ts',
    'pdfOcr' // folder
  ]
};

// Build map of item -> group


// Read all files before moving anything, store their contents and file paths.
// Then move files.
// Then compute new imports based on old absolute paths and write them to new paths.

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.vue')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allFiles = [...getAllFiles(srcDir), ...getAllFiles(testsDir)];
const fileData = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  fileData.push({ oldPath: file, content });
}

// 1. Move files and folders
for (const [group] of Object.entries(groups)) {
  const groupDir = path.join(servicesDir, group);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
  }
}

const itemToGroup = {};
for (const [group, items] of Object.entries(groups)) {
  for (const item of items) {
    const name = item.endsWith('.ts') ? item.slice(0, -3) : item;
    itemToGroup[name] = group;
  }
}

// Map old path to new path
function getNewPath(oldFilePath) {
  const normOld = oldFilePath.replace(/\\/g, '/');
  const normServicesDir = servicesDir.replace(/\\/g, '/');
  if (normOld.startsWith(normServicesDir + '/')) {
    const rel = normOld.substring(normServicesDir.length + 1);
    const parts = rel.split('/');
    const topLevelItem = parts[0];
    const name = topLevelItem.endsWith('.ts') ? topLevelItem.slice(0, -3) : topLevelItem;
    const group = itemToGroup[name];
    if (group) {
      return path.join(servicesDir, group, ...parts);
    }
  }
  return oldFilePath;
}

// Move them physically
for (const [group, items] of Object.entries(groups)) {
  const groupDir = path.join(servicesDir, group);
  for (const item of items) {
    const oldPath = path.join(servicesDir, item);
    const newPath = path.join(groupDir, item);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
  }
}

// Create index.ts for each group
for (const [group, items] of Object.entries(groups)) {
  const groupDir = path.join(servicesDir, group);
  const indexLines = [];
  for (const item of items) {
    if (item.endsWith('.ts')) {
      const name = item.slice(0, -3);
      indexLines.push(`export * from './${name}';`);
    } else {
      indexLines.push(`export * from './${item}';`);
    }
  }
  fs.writeFileSync(path.join(groupDir, 'index.ts'), indexLines.join('\n') + '\n', 'utf8');
}

// Update contents and write to new paths
for (const data of fileData) {
  let content = data.content;
  let changed = false;
  const newFilePath = getNewPath(data.oldPath);

  content = content.replace(/(import\s+.*?from\s+|import\s+|require\(\s*)['"]([^'"]+)['"]/g, (match, prefix, importPath) => {
    if (!importPath.startsWith('.')) return match;

    const absImportPath = path.resolve(path.dirname(data.oldPath), importPath);
    const normAbsImport = absImportPath.replace(/\\/g, '/');
    const normServicesDir = servicesDir.replace(/\\/g, '/');
    
    if (normAbsImport.startsWith(normServicesDir + '/')) {
      const rel = normAbsImport.substring(normServicesDir.length + 1);
      const parts = rel.split('/');
      const topLevelItem = parts[0];
      const group = itemToGroup[topLevelItem];
      
      if (group) {
        const targetAbsPath = path.join(servicesDir, group, ...parts);
        let newRelPath = path.relative(path.dirname(newFilePath), targetAbsPath).replace(/\\/g, '/');
        if (!newRelPath.startsWith('.')) {
          newRelPath = './' + newRelPath;
        }
        changed = true;
        return `${prefix}'${newRelPath}'`;
      }
    }
    
    // Also, if the current file is moved, its relative imports to NON-services files need to be updated!
    // For example, if AIService.ts (now in system/) imports `../../shared/types`, it needs an extra `../`.
    // Let's check if the target is NOT a service, but the file itself moved.
    if (newFilePath !== data.oldPath) {
      const targetAbsPath = absImportPath;
      let newRelPath = path.relative(path.dirname(newFilePath), targetAbsPath).replace(/\\/g, '/');
      if (!newRelPath.startsWith('.')) {
        newRelPath = './' + newRelPath;
      }
      changed = true;
      return `${prefix}'${newRelPath}'`;
    }

    return match;
  });

  // Always write to the new path
  fs.writeFileSync(newFilePath, content, 'utf8');
}

console.log('Done refactoring services and updating imports.');
