import { strToU8, zipSync } from 'fflate';
import { downloadFile } from './http';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ExportCell = string | number;
const xml = (value: ExportCell) => String(value)
  .split('').filter(character => character >= ' ' || '\t\r\n'.includes(character)).join('')
  .replace(/[<>&"'\r]/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;', '\r': '&#13;',
  })[character]!);

export function createCsv(rows: ExportCell[][]) {
  return '\uFEFF' + rows.map(row => row.map(cell => {
    const raw = String(cell);
    const safe = typeof cell === 'string' && /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}

const office = 'http://schemas.openxmlformats.org';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const names = {
  workbook: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
  worksheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
};
export function createWorkbook(rows: ExportCell[][]) {
  const sheet = rows.map((row, index) => '<row r="' + (index + 1) + '">' + row.map(cell =>
    typeof cell === 'number' ? '<c><v>' + cell + '</v></c>'
      : '<c t="inlineStr"><is><t xml:space="preserve">' + xml(cell) + '</t></is></c>').join('') + '</row>').join('');
  const files = {
    '[Content_Types].xml': '<Types xmlns="' + office + '/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="' + names.workbook + '"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="' + names.worksheet + '"/></Types>',
    '_rels/.rels': '<Relationships xmlns="' + office + '/package/2006/relationships"><Relationship Id="rId1" Type="' + office + '/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="' + office + '/spreadsheetml/2006/main" xmlns:r="' + office + '/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + office + '/package/2006/relationships"><Relationship Id="rId1" Type="' + office + '/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<worksheet xmlns="' + office + '/spreadsheetml/2006/main"><sheetData>' + sheet + '</sheetData></worksheet>',
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, strToU8(declaration + data)])));
}

async function createPdf(rows: ExportCell[][]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape' });
  // Draw with the browser font engine so Turkish characters remain intact.
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  const header = rows[0];
  const data = rows.slice(1);
  const rowHeight = 38;
  const pageRows = 21;
  const columnCount = Math.max(1, header?.length ?? 1);
  const width = canvas.width / columnCount;
  const pages = Math.max(1, Math.ceil(data.length / pageRows));
  for (let page = 0; page < pages; page++) {
    const table = [header, ...data.slice(page * pageRows, (page + 1) * pageRows)];
    canvas.height = rowHeight * table.length;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PDF rendering is unavailable');
    for (const [index, row] of table.entries()) {
      const y = index * rowHeight;
      context.fillStyle = index === 0 ? '#e1efec' : index % 2 ? '#ffffff' : '#f6f8f9';
      context.fillRect(0, y, canvas.width, rowHeight);
      context.fillStyle = '#17242c';
      context.font = (index === 0 ? '600 ' : '') + '20px sans-serif';
      context.textBaseline = 'middle';
      row?.forEach((cell, column) => {
        context.fillText(String(cell), column * width + 12, y + rowHeight / 2, width - 24);
      });
    }
    if (page > 0) pdf.addPage();
    const w = pdf.internal.pageSize.getWidth() - 20;
    pdf.addImage(canvas, 'PNG', 10, 10, w, canvas.height * w / canvas.width);
  }
  return pdf.output('blob');
}

export async function exportTable(format: ExportFormat, filename: string, rows: ExportCell[][]) {
  if (format === 'csv') {
    downloadFile(new Blob([createCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename + '.csv');
    return;
  }
  if (format === 'xlsx') {
    const bytes = new Uint8Array(createWorkbook(rows));
    downloadFile(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename + '.xlsx');
    return;
  }
  downloadFile(await createPdf(rows), filename + '.pdf');
}
