const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const testsDir = path.join(__dirname, '../tests');
const storesDir = path.join(__dirname, '../src/renderer/stores');

const groups = {
  system: [
    'aiStore.ts',
    'importTaskStore.ts',
    'taskMonitorStore.ts'
  ],
  contract: [
    'contractReceiptPaymentStore.ts',
    'receiptPlanStore.ts'
  ],
  file: [
    'fileCopyConflictStore.ts',
    'fileCopyTaskStore.ts',
    'thumbnailQueueStore.ts'
  ],
  project: [
    'projectManagementStore.ts',
    'projectStore.ts'
  ],
  library: [
    'libraryStore.ts'
  ],
  ui: [
    'panel.ts',
    'panelVisibility.ts',
    'sidebarStore.ts',
    'themeStore.ts',
    'windowState.ts'
  ]
};

// Build map of item -> group
const itemToGroup = {};
for (const [group, items] of Object.entries(groups)) {
  for (const item of items) {
    const name = item.endsWith('.ts') ? item.slice(0, -3) : item;
    itemToGroup[name] = group;
  }
}

// Read all files before moving anything, store their contents and file paths.
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

// 1. Ensure target group directories exist
for (const [group] of Object.entries(groups)) {
  const groupDir = path.join(storesDir, group);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
  }
}

// Map old path to new path
function getNewPath(oldFilePath) {
  const normOld = oldFilePath.replace(/\\/g, '/');
  const normStoresDir = storesDir.replace(/\\/g, '/');
  if (normOld.startsWith(normStoresDir + '/')) {
    const rel = normOld.substring(normStoresDir.length + 1);
    const parts = rel.split('/');
    if (parts.length === 1) { // It's directly in stores/
      const topLevelItem = parts[0];
      const name = topLevelItem.endsWith('.ts') ? topLevelItem.slice(0, -3) : topLevelItem;
      const group = itemToGroup[name];
      if (group) {
        return path.join(storesDir, group, topLevelItem);
      }
    }
  }
  return oldFilePath;
}

// Move files physically
for (const [group, items] of Object.entries(groups)) {
  const groupDir = path.join(storesDir, group);
  for (const item of items) {
    const oldPath = path.join(storesDir, item);
    const newPath = path.join(groupDir, item);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
  }
}

// Create index.ts for each group
for (const [group, items] of Object.entries(groups)) {
  const groupDir = path.join(storesDir, group);
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
    const normStoresDir = storesDir.replace(/\\/g, '/');
    
    // Check if it's importing a store
    if (normAbsImport.startsWith(normStoresDir + '/')) {
      const rel = normAbsImport.substring(normStoresDir.length + 1);
      const parts = rel.split('/');
      if (parts.length === 1) { // It's directly in stores/
        const topLevelItem = parts[0];
        // If there's no extension in import path, it might not end with .ts
        // Let's find it in itemToGroup
        const name = topLevelItem.endsWith('.ts') ? topLevelItem.slice(0, -3) : topLevelItem;
        const group = itemToGroup[name];
        
        if (group) {
          const targetAbsPath = path.join(storesDir, group, topLevelItem);
          let newRelPath = path.relative(path.dirname(newFilePath), targetAbsPath).replace(/\\/g, '/');
          if (!newRelPath.startsWith('.')) {
            newRelPath = './' + newRelPath;
          }
          changed = true;
          return `${prefix}'${newRelPath}'`;
        }
      }
    }
    
    // Update relative imports inside stores to other non-store modules
    if (newFilePath !== data.oldPath) {
      // If we are moving the store file, its imports pointing OUTSIDE the stores directory need adjustment
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

  // Write to the new path if the file moved or content changed
  if (changed || newFilePath !== data.oldPath) {
    fs.writeFileSync(newFilePath, content, 'utf8');
  }
}

console.log('Done refactoring stores and updating imports.');