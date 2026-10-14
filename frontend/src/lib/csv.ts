/** RFC 4180 bo'yicha bitta katak: vergul, qo'shtirnoq, qator ko'chishi bo'lsa — qo'shtirnoqda. */
function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Formula in'ektsiyasidan himoya: Excel `=`, `+`, `-`, `@` bilan boshlangan matnni formula deb oladi
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** UTF-8 BOM bilan (Excel kirill/o'zbek harflarini to'g'ri ochishi uchun) yuklab beradi. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
