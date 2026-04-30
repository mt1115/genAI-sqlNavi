import { NextResponse } from "next/server";
import { listProjectTables } from "@/lib/dify";
import { getProjectConfig } from "@/lib/projects";

type Body = {
  projectId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const project = getProjectConfig(body.projectId);
    const tables = await listProjectTables(project);

    return NextResponse.json({ tables });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch table list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
