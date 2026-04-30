export type ColumnDefinition = {
  logicalName: string;
  physicalName: string;
  dataType: string;
  description: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
};

export type TableDefinition = {
  sheetName: string;
  logicalName: string;
  physicalName: string;
  columns: ColumnDefinition[];
};

export type NormalizedWorkbook = {
  projectId: string;
  tables: TableDefinition[];
};
