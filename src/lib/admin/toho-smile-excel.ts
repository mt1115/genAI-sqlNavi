import * as XLSX from "xlsx";
import { type ColumnDefinition, type NormalizedWorkbook, type TableDefinition } from "@/lib/admin/types";

function normalizeCell(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function normalizeRow(row: unknown[]) {
  return row.map((cell) => normalizeCell(cell));
}

function buildDataType(typeValue: string, lengthValue: string) {
  if (!typeValue) {
    return "";
  }

  const type = typeValue.trim();
  const length = lengthValue.replace(/\s+/g, "");
  const normalizedType = type.toLowerCase();

  if (!length || ["date", "datetime", "timestamp", "time", "smallint", "integer", "int", "bigint"].includes(normalizedType)) {
    return type;
  }

  if (type.includes("(")) {
    return type;
  }

  return /^\d+$/.test(length) ? `${type}(${length})` : type;
}

function parseSbWorkbook(workbook: XLSX.WorkBook) {
  const tables: TableDefinition[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.includes("改定履歴") || sheetName.includes("テーブル一覧")) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];
    const rows = rawRows.map(normalizeRow).filter((row) => row.some(Boolean));
    if (rows.length === 0) continue;

    const objectName = rows[0]?.find((cell) => cell.startsWith("dbo.")) ?? sheetName;
    const logicalName = objectName.replace(/^dbo\./, "");
    const headerRowIndex = rows.findIndex((row) => row.includes("No") && row.some((cell) => cell.includes("ﾌｨｰﾙﾄﾞ名")));
    if (headerRowIndex < 0) continue;

    const columns: ColumnDefinition[] = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!/^\d+$/.test(row[0] ?? "")) continue;

      const logical = row[1] ?? "";
      if (!logical) continue;

      columns.push({
        logicalName: logical,
        physicalName: logical,
        dataType: buildDataType(row[3] ?? "", row[4] ?? ""),
        description: row[6] ?? "",
        isPrimaryKey: false,
        isNotNull: normalizeCell(row[5]).toUpperCase().includes("NOT NULL"),
      });
    }

    if (columns.length === 0) continue;

    tables.push({
      sheetName,
      logicalName,
      physicalName: objectName,
      columns,
    });
  }

  return tables;
}

function parseDwhWorkbook(workbook: XLSX.WorkBook) {
  const tables: TableDefinition[] = [];
  const logicalToPhysical = new Map<string, string>();

  const indexSheet = workbook.Sheets["ビュー一覧"];
  if (indexSheet) {
    const indexRows = XLSX.utils.sheet_to_json(indexSheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];
    for (const rawRow of indexRows) {
      const row = normalizeRow(rawRow);
      if (!/^\d+$/.test(row[0] ?? "")) continue;
      const physicalName = row[2] ?? "";
      const logicalName = row[10] ?? "";
      if (physicalName && logicalName) {
        logicalToPhysical.set(logicalName, physicalName);
      }
    }
  }

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.includes("改版履歴") || sheetName === "ビュー一覧") {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];
    const rows = rawRows.map(normalizeRow).filter((row) => row.some(Boolean));
    if (rows.length === 0) continue;

    const headerRowIndex = rows.findIndex((row) => row.includes("No") && row.some((cell) => cell.includes("ビュー項目名")));
    if (headerRowIndex < 0) continue;

    const columns: ColumnDefinition[] = [];
    for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!/^\d+$/.test(row[0] ?? "")) continue;

      const physicalName = row[2] ?? "";
      const logicalName = row[9] ?? "";
      if (!physicalName && !logicalName) continue;

      columns.push({
        logicalName: logicalName || physicalName,
        physicalName: physicalName || logicalName,
        dataType: "",
        description: "",
        isPrimaryKey: false,
        isNotNull: false,
      });
    }

    if (columns.length === 0) continue;

    tables.push({
      sheetName,
      logicalName: sheetName,
      physicalName: logicalToPhysical.get(sheetName) ?? sheetName,
      columns,
    });
  }

  return tables;
}

export function parseTohoSmileWorkbook(buffer: Buffer): NormalizedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0] ?? "";

  const tables =
    firstSheet.includes("改定履歴") || firstSheet.includes("テーブル一覧")
      ? parseSbWorkbook(workbook)
      : parseDwhWorkbook(workbook);

  return {
    projectId: "toho-smile",
    tables,
  };
}
