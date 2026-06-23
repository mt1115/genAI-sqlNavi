import { NextResponse } from "next/server";
import { runChat, runWorkflow } from "@/lib/dify";
import { getDifyUserFromAuthCookie } from "@/lib/auth";
import { getProjectConfig } from "@/lib/projects";

type Body = {
  projectId?: string;
  question?: string;
  contextType?: "table_analysis" | "table_summary" | "sql_review" | "table_list";
  tableName?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.question?.trim()) {
      return NextResponse.json({ error: "question is required." }, { status: 400 });
    }

    const project = getProjectConfig(body.projectId);
    const difyUser = await getDifyUserFromAuthCookie();

    if ((body.contextType ?? "table_analysis") === "sql_review") {
      const outputs = await runWorkflow(
        {
          project_id: project.id,
          project_name: project.name,
          kb_file: project.kbFile,
          request: body.question,
          user_instruction: body.question,
        },
        {
          purpose: "sql_review",
          user: difyUser,
        },
      );

      const answerKeys = ["answer", "text", "result", "sql", "query"];
      const answer =
        answerKeys
          .map((key) => outputs[key])
          .find((value): value is string => typeof value === "string" && value.trim().length > 0) ??
        JSON.stringify(outputs, null, 2);

      return NextResponse.json({ answer });
    }

    if ((body.contextType ?? "table_analysis") === "table_summary") {
      const outputs = await runWorkflow(
        {
          project_id: project.id,
          project_name: project.name,
          kb_file: project.kbFile,
          table_name: body.tableName ?? "",
          request: body.question,
          user_instruction: body.question,
        },
        {
          purpose: "table_summary",
          user: difyUser,
        },
      );

      const answerKeys = ["answer", "text", "result", "summary"];
      const answer =
        answerKeys
          .map((key) => outputs[key])
          .find((value): value is string => typeof value === "string" && value.trim().length > 0) ??
        JSON.stringify(outputs, null, 2);

      return NextResponse.json({ answer });
    }

    const answer = await runChat({
      query: body.question,
      inputs: {
        project_id: project.id,
        project_name: project.name,
        kb_file: project.kbFile,
        context_type: body.contextType ?? "table_analysis",
        table_name: body.tableName ?? "",
      },
      purpose: "default",
      user: difyUser,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query chat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
