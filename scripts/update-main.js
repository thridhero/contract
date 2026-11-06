const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '../src/main/main.ts');
let mainContent = fs.readFileSync(mainPath, 'utf8');

const replacements = [
  ['./ipc/handlers/windowHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/bootstrapHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/databaseHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/projectHandlers', './ipc/handlers/project'],
  ['./ipc/handlers/projectManagementHandlers', './ipc/handlers/project'],
  ['./ipc/handlers/documentHandlers', './ipc/handlers/file'],
  ['./ipc/handlers/workflowHandlers', './ipc/handlers/project'],
  ['./ipc/handlers/reminderHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/fileSystemHandlers', './ipc/handlers/file'],
  ['./ipc/handlers/shortcutHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/fileCopyHandlers', './ipc/handlers/file'],
  ['./ipc/handlers/libraryHandlers', './ipc/handlers/library'],
  ['./ipc/handlers/configHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/backupHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/aiHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/contractHandlers', './ipc/handlers/contract'],
  ['./ipc/handlers/supplierHandlers', './ipc/handlers/supplier'],
  ['./ipc/handlers/customerHandlers', './ipc/handlers/customer'],
  ['./ipc/handlers/contractProductHandlers', './ipc/handlers/contract'],
  ['./ipc/handlers/contractExecutionHandlers', './ipc/handlers/contract'],
  ['./ipc/handlers/contractReceiptPaymentHandlers', './ipc/handlers/contract'],
  ['./ipc/handlers/contractFileHandlers', './ipc/handlers/contract'],
  ['./ipc/handlers/dictionaryHandlers', './ipc/handlers/dictionary'],
  ['./ipc/handlers/treeDictionaryHandlers', './ipc/handlers/dictionary'],
  ['./ipc/handlers/logHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/fileConversionHandlers', './ipc/handlers/file'],
  ['./ipc/handlers/searchHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/importTaskHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/closeGuardHandlers', './ipc/handlers/system'],
  ['./ipc/handlers/taskMonitorHandlers', './ipc/handlers/system']
];

for (const [oldImport, newImport] of replacements) {
  // Replace the import path, but we might get multiple imports from the same directory.
  // Actually, we can just replace the import path. TypeScript will complain about duplicates but it's fine.
  // To avoid duplicate imports, we can rewrite the imports section.
  
  // Or we can just let eslint/prettier fix duplicate imports. Wait, we don't know if they have auto-fix.
}

// Let's manually rewrite the imports in main.ts
// We know all the handlers and where they are.
// We can just find the block of handler imports and replace it.

const handlerImportsBlock = `import { windowHandlers } from './ipc/handlers/system';
import { bootstrapHandlers } from './ipc/handlers/system';
import { databaseHandlers } from './ipc/handlers/system';
import { reminderHandlers } from './ipc/handlers/system';
import { shortcutHandlers } from './ipc/handlers/system';
import { configHandlers } from './ipc/handlers/system';
import { backupHandlers } from './ipc/handlers/system';
import { aiHandlers } from './ipc/handlers/system';
import { logHandlers } from './ipc/handlers/system';
import { searchHandlers } from './ipc/handlers/system';
import { importTaskHandlers } from './ipc/handlers/system';
import { closeGuardHandlers } from './ipc/handlers/system';
import { taskMonitorHandlers } from './ipc/handlers/system';

import { contractHandlers } from './ipc/handlers/contract';
import { contractProductHandlers } from './ipc/handlers/contract';
import { contractExecutionHandlers } from './ipc/handlers/contract';
import { contractReceiptPaymentHandlers } from './ipc/handlers/contract';
import { contractFileHandlers } from './ipc/handlers/contract';

import { fileSystemHandlers } from './ipc/handlers/file';
import { fileCopyHandlers } from './ipc/handlers/file';
import { fileConversionHandlers } from './ipc/handlers/file';
import { documentHandlers } from './ipc/handlers/file';

import { projectHandlers } from './ipc/handlers/project';
import { projectManagementHandlers } from './ipc/handlers/project';
import { workflowHandlers } from './ipc/handlers/project';

import { customerHandlers } from './ipc/handlers/customer';
import { supplierHandlers } from './ipc/handlers/supplier';

import { dictionaryHandlers } from './ipc/handlers/dictionary';
import { treeDictionaryHandlers } from './ipc/handlers/dictionary';

import { libraryHandlers } from './ipc/handlers/library';`;

// Regex to match the old block:
const oldBlockRegex = /import\s+\{\s*windowHandlers\s*\}.+?import\s+\{\s*taskMonitorHandlers\s*\}\s*from\s*'[^']+';/s;

mainContent = mainContent.replace(oldBlockRegex, handlerImportsBlock);

fs.writeFileSync(mainPath, mainContent, 'utf8');
console.log('Updated main.ts');
