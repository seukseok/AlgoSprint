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
  sampleTests?: { input: string; output: string }[];
  conceptGuide?: {
    coreConcepts: string[];
    approachSteps: string[];
    pitfalls: string[];
    complexity: {
      time: string;
      space: string;
    };
  };
}

export type JudgeAction = "compile" | "run" | "debug" | "submit";

export interface JudgeResult {
  action: JudgeAction;
  success: boolean;
  output: string;
  timeMs?: number;
  memoryKb?: number;
}
