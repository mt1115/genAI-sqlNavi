import { NextResponse } from "next/server";
import { runWorkflow } from "@/lib/dify";
import { getDifyUserFromAuthCookie } from "@/lib/auth";
import { getProjectConfig } from "@/lib/projects";

type Body = {
  projectId?: string;
  prompt?: string;
};

function extractSql(outputs: Record<string, unknown>) {
  const sqlCandidateKeys = ["sql", "query", "result", "answer", "text"];
  for (const key of sqlCandidateKeys) {
    const value = outputs[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return JSON.stringify(outputs, null, 2);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required." }, { status: 400 });
    }

    const project = getProjectConfig(body.projectId);
    const difyUser = await getDifyUserFromAuthCookie();

    const outputs = await runWorkflow(
      {
        project_id: project.id,
        project_name: project.name,
        kb_file: project.kbFile,
        // Keep both keys for compatibility with different workflow input schemas.
        request: body.prompt,
        user_instruction: body.prompt,
      },
      {
        user: difyUser,
      },
    );

    return NextResponse.json({
      sql: extractSql(outputs),
      raw: outputs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate SQL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
