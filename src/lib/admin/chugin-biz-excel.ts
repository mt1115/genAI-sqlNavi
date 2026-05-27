import * as XLSX from "xlsx";
import { type ColumnDefinition, type NormalizedWorkbook, type TableDefinition } from "@/lib/admin/types";

function normalizeCell(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function normalizeRow(row: unknown[]) {
  return row.map((cell) => normalizeCell(cell));
}

function findRowIndex(rows: string[][], predicate: (row: string[]) => boolean) {
  return rows.findIndex((row) => predicate(row));
}

function findValueAfterLabel(row: string[], label: string) {
  const labelIndex = row.findIndex((cell) => cell.includes(label));
  if (labelIndex < 0) {
    return "";
  }

  for (let index = labelIndex + 1; index < row.length; index += 1) {
    if (row[index]) {
      return row[index];
    }
  }

  return "";
}

function mergeHeaderRows(primary: string[], secondary?: string[]) {
  if (!secondary) {
    return primary;
  }

  return primary.map((cell, index) => {
    const next = secondary[index] ?? "";
    if (!cell) return next;
    if (!next) return cell;
    return `${cell} ${next}`.trim();
  });
}

function findColumnIndex(header: string[], ...keywords: string[]) {
  return header.findIndex((cell) => keywords.every((keyword) => cell.includes(keyword)));
}

function buildDataType(typeValue: string, lengthValue: string, precisionValue: string) {
  if (!typeValue) {
    return "";
  }

  if (typeValue.includes("(")) {
    return typeValue;
  }

  const normalizedLength = lengthValue.replace(/\s+/g, "");
  const normalizedPrecision = precisionValue.replace(/\s+/g, "");

  if (!normalizedLength) {
    return typeValue;
  }

  if (/^(int|integer|datetime|date|time|timestamp|money|smallint)$/i.test(typeValue)) {
    return typeValue;
  }

  if (normalizedPrecision && /^\d+$/.test(normalizedLength) && /^\d+$/.test(normalizedPrecision)) {
    return `${typeValue}(${normalizedLength},${normalizedPrecision})`;
  }

  if (/^\d+$/.test(normalizedLength)) {
    return `${typeValue}(${normalizedLength})`;
  }

  return typeValue;
}

function isMarked(value: string) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return normalized.includes("yes") || normalized.includes("○") || normalized.includes("〇");
}

function buildColumn(row: string[], header: string[]): ColumnDefinition | null {
  const physicalIndex = findColumnIndex(header, "物理名");
  const logicalIndex = findColumnIndex(header, "論理名");
  const typeIndex = findColumnIndex(header, "データ型");
  const lengthIndex = findColumnIndex(header, "桁数");
  const precisionIndex = findColumnIndex(header, "精度");
  const keyIndex = findColumnIndex(header, "KEY");
  const nullIndex = findColumnIndex(header, "NULL");
  const descriptionIndex = findColumnIndex(header, "内容");

  const physicalName = physicalIndex >= 0 ? row[physicalIndex] ?? "" : "";
  const logicalName = logicalIndex >= 0 ? row[logicalIndex] ?? "" : physicalName;

  if (!physicalName && !logicalName) {
    return null;
  }

  return {
    logicalName: logicalName || physicalName,
    physicalName: physicalName || logicalName,
    dataType: buildDataType(
      typeIndex >= 0 ? row[typeIndex] ?? "" : "",
      lengthIndex >= 0 ? row[lengthIndex] ?? "" : "",
      precisionIndex >= 0 ? row[precisionIndex] ?? "" : "",
    ),
    description: descriptionIndex >= 0 ? row[descriptionIndex] ?? "" : "",
    isPrimaryKey: keyIndex >= 0 ? isMarked(row[keyIndex] ?? "") : false,
    isNotNull: nullIndex >= 0 ? isMarked(row[nullIndex] ?? "") : false,
  };
}

export function parseChuginBizWorkbook(buffer: Buffer): NormalizedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const tables: TableDefinition[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];
    const rows = rawRows.map(normalizeRow).filter((row) => row.some(Boolean));

    if (rows.length === 0) {
      continue;
    }

    const headerRowIndex = findRowIndex(
      rows,
      (row) => row.includes("属性") && row.includes("KEY") && row.includes("NULL"),
    );
    if (headerRowIndex < 0) {
      continue;
    }

    const mergedHeader = mergeHeaderRows(rows[headerRowIndex], rows[headerRowIndex + 1]);
    const physicalHeaderIndex = mergedHeader.findIndex((cell) => cell.includes("物理名"));
    const logicalHeaderIndex = mergedHeader.findIndex((cell) => cell.includes("論理名"));
    if (physicalHeaderIndex < 0 || logicalHeaderIndex < 0) {
      continue;
    }

    const logicalName =
      findValueAfterLabel(rows[1] ?? [], "テーブル名") ||
      findValueAfterLabel(rows[2] ?? [], "テーブル名") ||
      sheetName;
    const physicalName =
      findValueAfterLabel(rows[2] ?? [], "テーブル物理名") ||
      findValueAfterLabel(rows[3] ?? [], "テーブル物理名") ||
      logicalName;

    const columns: ColumnDefinition[] = [];
    for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const firstCell = row.find((cell) => cell);
      if (!firstCell || !/^\d+$/.test(firstCell)) {
        continue;
      }

      const column = buildColumn(row, mergedHeader);
      if (!column) {
        continue;
      }

      columns.push(column);
    }

    if (columns.length === 0) {
      continue;
    }

    tables.push({
      sheetName,
      logicalName,
      physicalName,
      columns,
    });
  }

  return {
    projectId: "chugin_biz",
    tables,
  };
}
