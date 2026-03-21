import { Difficulty, Prisma } from "@prisma/client";
import { problemCatalog } from "./problem-catalog";
import { prisma } from "./prisma";

let initialized = false;

export async function ensureAppData() {
  if (initialized) return;

  for (const problem of problemCatalog) {
    await prisma.problem.upsert({
      where: { id: problem.id },
      update: {
        title: problem.title,
        difficulty: problem.difficulty as Difficulty,
        tags: JSON.stringify(problem.tags),
        summary: problem.summary,
        statement: problem.statement,
        sampleInput: problem.sampleInput,
        sampleOutput: problem.sampleOutput,
        starterCode: problem.starterCode,
      },
      create: {
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty as Difficulty,
        tags: JSON.stringify(problem.tags),
        summary: problem.summary,
        statement: problem.statement,
        sampleInput: problem.sampleInput,
        sampleOutput: problem.sampleOutput,
        starterCode: problem.starterCode,
      },
    });
  }

  initialized = true;
}

export type ProblemDTO = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  summary: string;
  statement: string;
  sampleInput: string;
  sampleOutput: string;
  starterCode: string;
};

export function mapProblem(problem: Prisma.ProblemGetPayload<object>): ProblemDTO {
  return {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    tags: safelyParseTags(problem.tags),
    summary: problem.summary,
    statement: problem.statement,
    sampleInput: problem.sampleInput,
    sampleOutput: problem.sampleOutput,
    starterCode: problem.starterCode,
  };
}

function safelyParseTags(tags: string) {
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === "string");
    return [];
  } catch {
    return [];
  }
}
