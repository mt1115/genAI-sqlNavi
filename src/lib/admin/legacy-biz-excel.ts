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

function findLabelValue(rows: string[][], label: string) {
  for (const row of rows.slice(0, 4)) {
    const labelIndex = row.findIndex((cell) => cell.includes(label));
    if (labelIndex < 0) continue;

    for (let index = labelIndex + 1; index < row.length; index += 1) {
      if (row[index]) {
        return row[index];
      }
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

function buildDataType(typeValue: string, lengthValue: string, precisionValue: string) {
  if (!typeValue) {
    return "";
  }

  const type = typeValue.trim();
  if (!lengthValue) {
    return type;
  }

  const length = lengthValue.replace(/\s+/g, "");
  const precision = precisionValue.replace(/\s+/g, "");
  const normalizedType = type.toLowerCase();

  if (type.includes("(")) {
    return type;
  }

  if (["date", "datetime", "timestamp", "time", "smallint", "integer", "int", "bigint"].includes(normalizedType)) {
    return type;
  }

  if (["decimal", "numeric"].includes(normalizedType) && /^\d+$/.test(length) && /^\d+$/.test(precision)) {
    return `${type}(${length},${precision})`;
  }

  if (/^\d+$/.test(length)) {
    return `${type}(${length})`;
  }

  return type;
}

function isMarked(value: string) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  if (!normalized) {
    return false;
  }

  return ["○", "〇", "yes", "true", "1", "pk", "key"].some((token) => normalized.includes(token));
}

function buildColumn(row: string[], header: string[]): ColumnDefinition | null {
  const physicalIndex = header.findIndex((cell) => cell.includes("物理名"));
  const logicalIndex = header.findIndex((cell) => cell.includes("論理名") || cell.includes("項目名"));
  const typeIndex = header.findIndex((cell) => cell.includes("データ型"));
  const lengthIndex = header.findIndex((cell) => cell.includes("桁数"));
  const precisionIndex = header.findIndex((cell) => cell.includes("精度"));
  const keyIndex = header.findIndex((cell) => /(^| )KEY($| )/.test(cell));
  const nullIndex = header.findIndex((cell) => /(^| )NULL($| )/.test(cell));
  const descriptionIndex = header.findIndex((cell) => cell.includes("内容") || cell.includes("備考"));

  const physicalName = physicalIndex >= 0 ? row[physicalIndex] ?? "" : "";
  const logicalName = logicalIndex >= 0 ? row[logicalIndex] ?? "" : physicalName;

  if (!physicalName && !logicalName) {
    return null;
  }

  const isPrimaryKey = keyIndex >= 0 ? isMarked(row[keyIndex] ?? "") : false;
  const nullCell = nullIndex >= 0 ? row[nullIndex] ?? "" : "";

  return {
    logicalName: logicalName || physicalName,
    physicalName: physicalName || logicalName,
    dataType: buildDataType(
      typeIndex >= 0 ? row[typeIndex] ?? "" : "",
      lengthIndex >= 0 ? row[lengthIndex] ?? "" : "",
      precisionIndex >= 0 ? row[precisionIndex] ?? "" : "",
    ),
    description: descriptionIndex >= 0 ? row[descriptionIndex] ?? "" : "",
    isPrimaryKey,
    isNotNull: isPrimaryKey || !isMarked(nullCell),
  };
}

export function parseLegacyBizWorkbook(buffer: Buffer, projectId: string): NormalizedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const tables: TableDefinition[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.includes("改版") || sheetName.includes("改定") || sheetName.includes("ビュー一覧")) {
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

    const logicalName = findLabelValue(rows, "テーブル名") || sheetName;
    const physicalName = findLabelValue(rows, "テーブル物理名") || logicalName;

    const headerRowIndex = findRowIndex(
      rows,
      (row) => row.includes("No") && row.includes("項目名") && row.includes("属性"),
    );
    if (headerRowIndex < 0) {
      continue;
    }

    const secondaryHeader = rows[headerRowIndex + 1];
    const effectiveHeader = mergeHeaderRows(rows[headerRowIndex], secondaryHeader);
    const columns: ColumnDefinition[] = [];

    for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!/^\d+$/.test(row[0] ?? "")) {
        continue;
      }

      const column = buildColumn(row, effectiveHeader);
      if (column) {
        columns.push(column);
      }
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
    projectId,
    tables,
  };
}
