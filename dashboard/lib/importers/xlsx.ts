import type ExcelJS from 'exceljs'

/** A path on disk, or a downloaded file: `name` is the file name only, used in messages and meta. */
export type XlsxInput = string | { name: string; data: Buffer }

export async function loadWorkbook(wb: ExcelJS.Workbook, input: XlsxInput): Promise<void> {
  if (typeof input === 'string') await wb.xlsx.readFile(input)
  else await wb.xlsx.load(input.data as unknown as ArrayBuffer)
}
