export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  summary: string;
  statement: string;
  sampleInput: string;
  sampleOutput: string;
  starterCode: string;
}

export type JudgeAction = "compile" | "run" | "debug" | "submit";

export interface JudgeResult {
  action: JudgeAction;
  success: boolean;
  output: string;
  timeMs?: number;
  memoryKb?: number;
}
