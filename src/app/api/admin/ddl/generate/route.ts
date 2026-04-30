import { NextResponse } from "next/server";
import { generateProjectDdl, supportsProjectExcel } from "@/lib/admin/project-excel";
import { type NormalizedWorkbook } from "@/lib/admin/types";

type GenerateRequestBody = {
  projectId?: string;
  mapping?: NormalizedWorkbook;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const projectId = String(body.projectId ?? "");
    const mapping = body.mapping;

    if (!supportsProjectExcel(projectId)) {
      return NextResponse.json({ error: `Project '${projectId}' is not supported yet.` }, { status: 400 });
    }

    if (!mapping || !Array.isArray(mapping.tables)) {
      return NextResponse.json({ error: "Normalized mapping is required." }, { status: 400 });
    }

    const ddl = generateProjectDdl(projectId, {
      projectId,
      tables: mapping.tables,
    });

    return NextResponse.json({ ddl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate DDL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
