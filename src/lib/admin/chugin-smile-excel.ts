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

function findCellIndex(row: string[], matcher: (cell: string) => boolean) {
  return row.findIndex((cell) => matcher(cell));
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

  if (/^(int|integer|datetime|date|time|money|smallint)$/i.test(typeValue)) {
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

function isPrimaryKey(value: string) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return ["yes", "〇", "○"].some((token) => normalized.includes(token));
}

function isNotNullFromNullColumn(value: string) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return normalized === "no" || normalized === "〇" || normalized === "○";
}

function buildColumn(row: string[], header: string[]): ColumnDefinition | null {
  const logicalIndex = findCellIndex(header, (cell) => cell === "項目名");
  const physicalIndex = findCellIndex(header, (cell) => cell === "カラム名");
  const keyIndex = findCellIndex(header, (cell) => cell === "KEY");
  const nullIndex = findCellIndex(header, (cell) => cell === "NULL" || cell === "必須");
  const typeIndex = findCellIndex(header, (cell) => cell === "データ型");
  const lengthIndex = findCellIndex(header, (cell) => cell.includes("データ長") || cell.includes("バイト数"));
  const precisionIndex = findCellIndex(header, (cell) => cell === "精度");
  const descriptionIndex = findCellIndex(header, (cell) => cell === "内容");

  const logicalName = logicalIndex >= 0 ? row[logicalIndex] ?? "" : "";
  const physicalName = physicalIndex >= 0 ? row[physicalIndex] ?? "" : logicalName;

  if (!logicalName && !physicalName) {
    return null;
  }

  const dataType = buildDataType(
    typeIndex >= 0 ? row[typeIndex] ?? "" : "",
    lengthIndex >= 0 ? row[lengthIndex] ?? "" : "",
    precisionIndex >= 0 ? row[precisionIndex] ?? "" : "",
  );

  return {
    logicalName: logicalName || physicalName,
    physicalName: physicalName || logicalName,
    dataType,
    description: descriptionIndex >= 0 ? row[descriptionIndex] ?? "" : "",
    isPrimaryKey: keyIndex >= 0 ? isPrimaryKey(row[keyIndex] ?? "") : false,
    isNotNull: nullIndex >= 0 ? isNotNullFromNullColumn(row[nullIndex] ?? "") : false,
  };
}

export function parseChuginSmileWorkbook(buffer: Buffer): NormalizedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const tables: TableDefinition[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.startsWith("old_") || sheetName.startsWith("V_")) {
      continue;
    }

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
      (row) => row.includes("項目名") && row.includes("カラム名") && (row.includes("KEY") || row.includes("必須")),
    );
    if (headerRowIndex < 0) {
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
    const header = rows[headerRowIndex];
    const columns: ColumnDefinition[] = [];

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const numberCell = row.find((cell) => /^\d+$/.test(cell));
      if (!numberCell) {
        continue;
      }

      const column = buildColumn(row, header);
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
    projectId: "chugin-smile",
    tables,
  };
}
