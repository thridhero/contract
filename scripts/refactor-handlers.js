const fs = require('fs');
const path = require('path');

const handlersDir = path.join(__dirname, '../src/main/ipc/handlers');

const groups = {
  system: [
    'aiHandlers.ts',
    'backupHandlers.ts',
    'bootstrapHandlers.ts',
    'closeGuardHandlers.ts',
    'configHandlers.ts',
    'databaseHandlers.ts',
    'logHandlers.ts',
    'reminderHandlers.ts',
    'searchHandlers.ts',
    'shortcutHandlers.ts',
    'windowHandlers.ts',
    'taskMonitorHandlers.ts',
    'importTaskHandlers.ts'
  ],
  contract: [
    'contractHandlers.ts',
    'contractProductHandlers.ts',
    'contractExecutionHandlers.ts',
    'contractReceiptPaymentHandlers.ts',
    'contractFileHandlers.ts'
  ],
  file: [
    'fileSystemHandlers.ts',
    'fileCopyHandlers.ts',
    'fileConversionHandlers.ts',
    'documentHandlers.ts'
  ],
  project: [
    'projectHandlers.ts',
    'projectManagementHandlers.ts',
    'workflowHandlers.ts'
  ],
  customer: [
    'customerHandlers.ts'
  ],
  supplier: [
    'supplierHandlers.ts'
  ],
  dictionary: [
    'dictionaryHandlers.ts',
    'treeDictionaryHandlers.ts'
  ],
  library: [
    'libraryHandlers.ts'
  ]
};

// Build map of file -> group
const fileToGroup = {};
for (const [group, files] of Object.entries(groups)) {
  for (const file of files) {
    fileToGroup[file.replace('.ts', '')] = group;
  }
}

function updateImports(filePath, currentGroup) {
  if (!filePath.endsWith('.ts')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Update inter-handler imports
  // from './taskMonitorHandlers'
  content = content.replace(/from\s+['"]\.\/([^'"]+)['"]/g, (match, p1) => {
    // Check if p1 is a handler file
    // Some might be 'contract-files/mutationHandlers', which we will handle later.
    const targetGroup = fileToGroup[p1];
    if (targetGroup) {
      if (targetGroup === currentGroup) {
        return `from './${p1}'`;
      } else {
        return `from '../${targetGroup}/${p1}'`;
      }
    }
    // For contract-files/..., keep it as is if we move it together
    return match;
  });

  // 2. Update parent imports
  // from '../channels' -> from '../../channels'
  // from '../../services/DatabaseService' -> from '../../../services/DatabaseService'
  // Note: we only want to replace imports that go up the tree.
  content = content.replace(/from\s+['"](\.\.\/[^'"]+)['"]/g, (match, p1) => {
    return `from '../${p1}'`;
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
}

function updateContractFilesSubFolder() {
  const subFolder = path.join(handlersDir, 'contract/contract-files');
  if (fs.existsSync(subFolder)) {
    const files = fs.readdirSync(subFolder);
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const filePath = path.join(subFolder, file);
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/from\s+['"](\.\.\/[^'"]+)['"]/g, (match, p1) => {
          return `from '../${p1}'`;
        });
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
  }
}

function updateLibrarySubFolder() {
  const subFolder = path.join(handlersDir, 'library/library');
  if (fs.existsSync(subFolder)) {
    // The existing 'library' folder was moved inside the new 'library' group folder.
    // We don't want 'library/library', let's move its contents out or just update imports.
    // Wait, the new group is 'library', the old subfolder is 'library'.
    // If we move the old subfolder into 'library', it becomes 'library/library'.
    // Let's just update imports for 'library/library'.
    const files = fs.readdirSync(subFolder);
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const filePath = path.join(subFolder, file);
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/from\s+['"](\.\.\/[^'"]+)['"]/g, (match, p1) => {
          return `from '../${p1}'`;
        });
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
  }
}

// Ensure groups exist
for (const [group] of Object.entries(groups)) {
  const groupDir = path.join(handlersDir, group);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
  }
}

// Move folders first
const foldersToMove = [
  { old: path.join(handlersDir, 'contract-files'), new: path.join(handlersDir, 'contract/contract-files') },
  // Wait, if I move 'library' folder to 'library/library', it's weird. 
  // Let's just move its contents directly to 'library/' or leave them in a subfolder.
  // I will move 'library' folder contents to 'library/' directly? No, the files inside might conflict.
  // Let's move the folder to 'library/modules' ? No, 'library/library' is fine.
  { old: path.join(handlersDir, 'library'), new: path.join(handlersDir, 'library/library') }
];

for (const folder of foldersToMove) {
  if (fs.existsSync(folder.old) && fs.statSync(folder.old).isDirectory()) {
    if (folder.old !== folder.new) {
      const tempPath = folder.old + '_temp';
      fs.renameSync(folder.old, tempPath);
      // Wait, we need to make sure the target directory exists
      fs.mkdirSync(path.dirname(folder.new), { recursive: true });
      fs.renameSync(tempPath, folder.new);
    }
  }
}

for (const [group, files] of Object.entries(groups)) {
  const groupDir = path.join(handlersDir, group);
  
  for (const file of files) {
    const oldPath = path.join(handlersDir, file);
    const newPath = path.join(groupDir, file);
    
    if (fs.existsSync(oldPath)) {
      if (!fs.statSync(oldPath).isDirectory()) {
        fs.renameSync(oldPath, newPath);
        updateImports(newPath, group);
      }
    }
  }
  
  // Create index.ts
  const indexLines = [];
  for (const file of files) {
    if (file.endsWith('.ts')) {
      const name = file.replace('.ts', '');
      indexLines.push(`export * from './${name}';`);
    }
  }
  fs.writeFileSync(path.join(groupDir, 'index.ts'), indexLines.join('\n') + '\n', 'utf8');
}

updateContractFilesSubFolder();
updateLibrarySubFolder();

console.log('Done moving and updating files.');
