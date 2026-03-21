import { NextResponse } from "next/server";
import { getMockUser } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { JudgeAction } from "@/lib/types";

type ExecuteRequest = {
  action: Exclude<JudgeAction, "submit">;
  problemId: string;
  source: string;
  stdin?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ExecuteRequest;

  if (!body?.action || !body.problemId || !body.source) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const user = await getMockUser();
  const stdin = body.stdin ?? "";
  const hasMain = body.source.includes("main(");

  const outputByAction = {
    compile: hasMain
      ? "Compilation successful (server mock)."
      : "Compilation failed (server mock): missing main()",
    run: `Program executed (server mock).\nInput:\n${stdin || "(empty)"}\n\nOutput:\nHello from AlgoSprint runner.`,
    debug: "Debug bridge is placeholder. Step/breakpoint protocol will be attached in Milestone 3.",
  } as const;

  const success = body.action === "compile" ? hasMain : true;
  const result = {
    action: body.action,
    success,
    output: outputByAction[body.action],
    timeMs: body.action === "compile" ? undefined : 12,
    memoryKb: body.action === "compile" ? undefined : 3072,
  };

  await prisma.run.create({
    data: {
      action: body.action,
      source: body.source,
      stdin,
      output: result.output,
      success,
      timeMs: result.timeMs,
      memoryKb: result.memoryKb,
      userId: user.id,
      problemId: body.problemId,
    },
  });

  return NextResponse.json(result);
}
