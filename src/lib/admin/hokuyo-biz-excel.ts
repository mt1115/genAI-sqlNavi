import { parseLegacyBizWorkbook } from "@/lib/admin/legacy-biz-excel";

export function parseHokuyoBizWorkbook(buffer: Buffer) {
  return parseLegacyBizWorkbook(buffer, "hokuyo_biz");
}
