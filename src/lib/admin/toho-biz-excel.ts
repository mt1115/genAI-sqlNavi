import { parseLegacyBizWorkbook } from "@/lib/admin/legacy-biz-excel";

export function parseTohoBizWorkbook(buffer: Buffer) {
  return parseLegacyBizWorkbook(buffer, "toho-biz");
}
