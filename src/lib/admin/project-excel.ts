import { parseChuginBizWorkbook } from "@/lib/admin/chugin-biz-excel";
import { parseChuginSmileWorkbook } from "@/lib/admin/chugin-smile-excel";
import { buildDdlWithComments, parseDefaultWorkbook } from "@/lib/admin/default-excel";
import { parseHokuyoBizWorkbook } from "@/lib/admin/hokuyo-biz-excel";
import { parseHokuyoSmileWorkbook } from "@/lib/admin/hokuyo-smile-excel";
import { parseTohoBizWorkbook } from "@/lib/admin/toho-biz-excel";
import { parseTohoSmileWorkbook } from "@/lib/admin/toho-smile-excel";
import { type NormalizedWorkbook } from "@/lib/admin/types";

type ProjectExcelAdapter = {
  parse: (buffer: Buffer) => NormalizedWorkbook;
  generateDdl: (mapping: NormalizedWorkbook) => string;
};

const projectExcelAdapters: Record<string, ProjectExcelAdapter> = {
  default: {
    parse: parseDefaultWorkbook,
    generateDdl: (mapping) => buildDdlWithComments(mapping.tables),
  },
  chugin_smile: {
    parse: parseChuginSmileWorkbook,
    generateDdl: (mapping) => buildDdlWithComments(mapping.tables),
  },
  chugin_biz: {
    parse: parseChuginBizWorkbook,
    generateDdl: (mapping) => buildDdlWithComments(mapping.tables),
  },
  hokuyo_smile: {
    parse: parseHokuyoSmileWorkbook,
    generateDdl: (mapping) => buildDdlWithComments(mapping.tables),
  },
  hokuyo_biz: {
    parse: parseHokuyoBizWorkbook,
    generateDdl: (mapping) => buildDdlWithComments(mapping.tables),
  },
  toho_biz: {
    parse: parseTohoBizWorkbook,
    generateDdl: (mapping) => buildDdlWithComments(mapping.tables),
  },
  toho_smile: {
    parse: parseTohoSmileWorkbook,
    generateDdl: (mapping) => buildDdlWithComments(mapping.tables),
  },
};

export function supportsProjectExcel(projectId: string) {
  return projectId in projectExcelAdapters;
}

export function parseProjectWorkbook(projectId: string, buffer: Buffer) {
  const adapter = projectExcelAdapters[projectId];
  if (!adapter) {
    throw new Error(`Project '${projectId}' is not supported yet.`);
  }

  return adapter.parse(buffer);
}

export function generateProjectDdl(projectId: string, mapping: NormalizedWorkbook) {
  const adapter = projectExcelAdapters[projectId];
  if (!adapter) {
    throw new Error(`Project '${projectId}' is not supported yet.`);
  }

  return adapter.generateDdl(mapping);
}
