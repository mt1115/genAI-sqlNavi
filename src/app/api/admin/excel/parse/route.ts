import { NextResponse } from "next/server";
import { parseProjectWorkbook, supportsProjectExcel } from "@/lib/admin/project-excel";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const projectId = String(formData.get("projectId") ?? "");
    const file = formData.get("file");

    if (!supportsProjectExcel(projectId)) {
      return NextResponse.json({ error: `Project '${projectId}' is not supported yet.` }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Excel file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseProjectWorkbook(projectId, buffer);

    return NextResponse.json({
      mapping: parsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse Excel file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
