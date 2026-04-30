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

function isHeaderRow(row: string[]) {
  const cells = row.filter(Boolean);
  const normalized = cells.join("|");
  const hasColumnName =
    normalized.includes("項目名") || normalized.includes("列名") || normalized.includes("No.");
  const hasNamePair = normalized.includes("日本語名") && normalized.includes("物理名");
  const hasTypeHints =
    normalized.includes("型") || normalized.includes("データ型") || normalized.includes("桁") || normalized.includes("サイズ");

  return (hasColumnName && hasTypeHints) || (hasNamePair && hasTypeHints);
}

function mergeHeaderRows(primary: string[], secondary?: string[]) {
  if (!secondary) {
    return primary;
  }

  return primary.map((cell, index) => {
    const next = secondary[index] ?? "";
    if (!cell) {
      return next;
    }
    if (!next) {
      return cell;
    }
    return `${cell} ${next}`.trim();
  });
}

function looksLikePhysicalName(value: string) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(value) || /^[A-Z0-9_]+$/.test(value);
}

function buildDataType(typeValue: string, sizeValue: string) {
  if (!typeValue) return "";
  if (!sizeValue) return typeValue;

  const normalizedSize = sizeValue.replace(/\s+/g, "");
  if (typeValue.includes("(")) return typeValue;
  if (!/^\d+(,\d+)?$/.test(normalizedSize)) return typeValue;

  return `${typeValue}(${normalizedSize})`;
}

function includesNormalized(cell: string, keyword: string) {
  return cell.replace(/\s+/g, "").toLowerCase().includes(keyword.replace(/\s+/g, "").toLowerCase());
}

function isMarked(value: string) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();

  if (!normalized) {
    return false;
  }

  return ["\u25cb", "yes", "yes(pk)", "pk", "key", "true", "1"].some((token) => normalized.includes(token));
}

function resolveTableMeta(sheetName: string, rows: string[][]) {
  const first = rows[0] ?? [];
  const second = rows[1] ?? [];

  const firstCell = first[0] ?? "";
  if (firstCell === "SELECT") {
    return null;
  }

  if (firstCell.includes("テーブル名：")) {
    const logicalName = firstCell.split("：")[1]?.trim() || sheetName;
    return {
      logicalName,
      physicalName: logicalName,
    };
  }

  if ((first[1] ?? "").includes("テーブル名（日本語名）")) {
    const logicalName = second[1] || sheetName;
    const physicalName = second[4] || logicalName;
    return { logicalName, physicalName };
  }

  if (looksLikePhysicalName(firstCell) && second.some((cell) => cell.includes("日本語名"))) {
    return {
      logicalName: sheetName,
      physicalName: firstCell,
    };
  }

  return {
    logicalName: sheetName,
    physicalName: looksLikePhysicalName(firstCell) ? firstCell : sheetName,
  };
}

function buildColumn(row: string[], header: string[]): ColumnDefinition | null {
  const logicalIndex = header.findIndex((cell) => cell.includes("論理名") || cell.includes("日本語名"));
  const physicalIndex = header.findIndex((cell) => cell.includes("物理名"));
  const itemIndex = header.findIndex((cell) => cell.includes("項目名"));
  const typeIndex = header.findIndex((cell) => cell === "型" || cell.includes("データ型"));
  const sizeIndex = header.findIndex((cell) => cell.includes("サイズ") || cell.includes("桁"));
  const descriptionIndex = header.findIndex((cell) => cell.includes("説明") || cell.includes("備考"));
  const pkIndex = header.findIndex(
    (cell) => includesNormalized(cell, "pk") || includesNormalized(cell, "key"),
  );
  const notNullIndex = header.findIndex(
    (cell) => includesNormalized(cell, "not null") || includesNormalized(cell, "notnull"),
  );

  const logicalName =
    (logicalIndex >= 0 ? row[logicalIndex] : "") ||
    (itemIndex >= 0 ? row[itemIndex] : "") ||
    (physicalIndex >= 0 ? row[physicalIndex] : "");

  const physicalName =
    (physicalIndex >= 0 ? row[physicalIndex] : "") ||
    (itemIndex >= 0 ? row[itemIndex] : "") ||
    logicalName;

  if (!logicalName && !physicalName) {
    return null;
  }

  const dataType =
    typeIndex >= 0 ? buildDataType(row[typeIndex] ?? "", sizeIndex >= 0 ? row[sizeIndex] ?? "" : "") : "";

  return {
    logicalName: logicalName || physicalName,
    physicalName: physicalName || logicalName,
    dataType,
    description: descriptionIndex >= 0 ? row[descriptionIndex] ?? "" : "",
    isPrimaryKey:
      (pkIndex >= 0 && isMarked(row[pkIndex] ?? "")) ||
      (notNullIndex >= 0 && includesNormalized(row[notNullIndex] ?? "", "pk")),
    isNotNull:
      (notNullIndex >= 0 && isMarked(row[notNullIndex] ?? "")) ||
      (pkIndex >= 0 && includesNormalized(row[pkIndex] ?? "", "pk")),
  };
}

export function parseHokuyoSmileWorkbook(buffer: Buffer): NormalizedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const tables: TableDefinition[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (["改訂履歴", "SB_DB", "DWH_DB"].includes(sheetName)) {
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

    const tableMeta = resolveTableMeta(sheetName, rows);
    if (!tableMeta) {
      continue;
    }

    const headerRowIndex = findRowIndex(rows, isHeaderRow);
    if (headerRowIndex < 0) {
      continue;
    }

    const header = rows[headerRowIndex];
    const secondaryHeader = rows[headerRowIndex + 1];
    const hasSecondaryHeader = secondaryHeader?.some(
      (cell) => cell.includes("日本語名") || cell.includes("物理名") || cell.includes("データ型"),
    );
    const effectiveHeader = hasSecondaryHeader ? mergeHeaderRows(header, secondaryHeader) : header;
    const dataStartIndex = headerRowIndex + (hasSecondaryHeader ? 2 : 1);
    const columns: ColumnDefinition[] = [];

    for (let rowIndex = dataStartIndex; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const hasOnlySequence = row.filter(Boolean).length === 1 && /^\d+$/.test(row.find(Boolean) ?? "");
      if (hasOnlySequence) {
        continue;
      }

      const hasRequiredCells =
        row.some((cell) => looksLikePhysicalName(cell)) ||
        row.some((cell) => includesNormalized(cell, "char")) ||
        row.some((cell) => includesNormalized(cell, "int")) ||
        row.some((cell) => includesNormalized(cell, "date")) ||
        row.some((cell) => includesNormalized(cell, "time"));
      if (!hasRequiredCells) {
        continue;
      }

      const column = buildColumn(row, effectiveHeader);
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
      logicalName: tableMeta.logicalName,
      physicalName: tableMeta.physicalName,
      columns,
    });
  }

  return {
    projectId: "hokuyo-smile",
    tables,
  };
}
