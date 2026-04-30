import * as XLSX from "xlsx";
import { type ColumnDefinition, type NormalizedWorkbook, type TableDefinition } from "@/lib/admin/types";

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function findRowIndex(rows: unknown[][], predicate: (row: string[]) => boolean) {
  return rows.findIndex((row) => predicate(row.map((cell) => normalizeCell(cell))));
}

function isColumnHeaderRow(row: string[]) {
  const first = row[0] ?? "";
  const second = row[1] ?? "";

  return (
    (first.includes("項目名") || first.includes("カラム名") || first.includes("論理名")) &&
    (second.includes("項目名") || second.includes("カラム名") || second.includes("物理名"))
  );
}

function buildColumn(rows: unknown[][], rowIndex: number): ColumnDefinition | null {
  const row = rows[rowIndex] ?? [];
  const logicalName = normalizeCell(row[0]);
  const physicalName = normalizeCell(row[1]);

  if (!logicalName || !physicalName) {
    return null;
  }

  return {
    logicalName,
    physicalName,
    dataType: normalizeCell(row[2]),
    description: normalizeCell(row[row.length - 1]),
    isPrimaryKey: false,
    isNotNull: false,
  };
}

export function parseDefaultWorkbook(buffer: Buffer): NormalizedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const tables: TableDefinition[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    const logicalNameRowIndex = findRowIndex(
      rows,
      (row) => (row[0] ?? "").includes("テーブル名") && (row[0] ?? "").includes("論理"),
    );
    const physicalNameRowIndex = findRowIndex(
      rows,
      (row) => (row[0] ?? "").includes("テーブル名") && (row[0] ?? "").includes("物理"),
    );

    const logicalName =
      logicalNameRowIndex >= 0 ? normalizeCell(rows[logicalNameRowIndex]?.[1]) : normalizeCell(rows[0]?.[1]);
    const physicalName =
      physicalNameRowIndex >= 0
        ? normalizeCell(rows[physicalNameRowIndex]?.[1])
        : normalizeCell(rows[1]?.[1]);

    if (!logicalName || !physicalName) {
      continue;
    }

    const headerRowIndex = findRowIndex(rows, isColumnHeaderRow);
    const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 4;

    const columns: ColumnDefinition[] = [];
    for (let rowIndex = dataStartIndex; rowIndex < rows.length; rowIndex += 1) {
      const column = buildColumn(rows, rowIndex);
      if (column) {
        columns.push(column);
      }
    }

    tables.push({
      sheetName,
      logicalName,
      physicalName,
      columns,
    });
  }

  return {
    projectId: "default",
    tables,
  };
}

export function buildCommentSql(tables: TableDefinition[]) {
  const statements: string[] = [];

  for (const table of tables) {
    statements.push(`COMMENT ON TABLE ${table.physicalName} IS '${table.logicalName}';`);

    for (const column of table.columns) {
      const commentText = column.description
        ? `${column.logicalName} - ${column.description}`
        : column.logicalName;

      statements.push(
        `COMMENT ON COLUMN ${table.physicalName}.${column.physicalName} IS '${commentText.replace(/'/g, "''")}';`,
      );
    }

    statements.push("");
  }

  return statements.join("\n").trim();
}

export function buildCreateTableSql(tables: TableDefinition[]) {
  const statements: string[] = [];

  for (const table of tables) {
    const columnLines = table.columns.map((column) => {
      const parts = [column.physicalName];
      if (column.dataType) {
        parts.push(column.dataType);
      }
      if (column.isNotNull) {
        parts.push("NOT NULL");
      }
      return `  ${parts.join(" ")}`;
    });
    const primaryKeyColumns = table.columns.filter((column) => column.isPrimaryKey).map((column) => column.physicalName);
    const sanitizedTableName = table.physicalName.replace(/[^\p{L}\p{N}_]/gu, "_");
    const constraintLines =
      primaryKeyColumns.length > 0
        ? [`  CONSTRAINT pk_${sanitizedTableName} PRIMARY KEY (${primaryKeyColumns.join(", ")})`]
        : [];
    const lines = [...columnLines, ...constraintLines];

    statements.push(`CREATE TABLE ${table.physicalName} (`);
    statements.push(lines.join(",\n"));
    statements.push(");");
    statements.push("");
  }

  return statements.join("\n").trim();
}

export function buildDdlWithComments(tables: TableDefinition[]) {
  const createTableSql = buildCreateTableSql(tables);
  const commentSql = buildCommentSql(tables);

  return [createTableSql, commentSql].filter(Boolean).join("\n\n").trim();
}
