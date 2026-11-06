import * as XLSX from 'xlsx';

export interface ExcelColumn {
  field: string;
  header: string;
  format?: (val: any, row: any) => any;
}

export async function exportToExcel(
  data: any[],
  columns: ExcelColumn[],
  defaultFilename: string = 'export.xlsx'
): Promise<{ success: boolean; filePath?: string }> {
  try {
    // 1. Format data
    const wsData = data.map((row) => {
      const newRow: Record<string, any> = {};
      for (const col of columns) {
        let val = row[col.field];
        if (col.format) {
          val = col.format(val, row);
        }
        newRow[col.header] = val ?? '';
      }
      return newRow;
    });

    // 2. Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(wsData);
    
    // Auto-adjust column widths
    const colWidths = columns.map(col => {
      // Find the max length in this column
      let maxLen = col.header.length;
      for (const row of wsData) {
        const val = row[col.header];
        if (val !== null && val !== undefined) {
          const str = String(val);
          // Chinese characters roughly count as 2 widths
          const len = str.replace(/[\u4e00-\u9fa5]/g, 'aa').length;
          if (len > maxLen) {
            maxLen = len;
          }
        }
      }
      return { wch: Math.min(maxLen + 2, 50) }; // cap at 50 width
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    // 3. Write to array buffer
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const buffer = new Uint8Array(wbout);

    // 4. Save file via electron API
    const saveResult = await window.electronAPI.fs.saveFile({
      title: '导出 Excel',
      defaultPath: defaultFilename,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
    });

    if (saveResult.success && saveResult.data && !saveResult.data.canceled && saveResult.data.filePath) {
      const writeResult = await window.electronAPI.fs.writeFileBytes(saveResult.data.filePath, buffer);
      if (writeResult.success) {
        return { success: true, filePath: saveResult.data.filePath };
      }
      throw new Error(writeResult.error || '写入文件失败');
    }
    return { success: false }; // Canceled
  } catch (error) {
    console.error('Export to excel failed:', error);
    throw error;
  }
}
