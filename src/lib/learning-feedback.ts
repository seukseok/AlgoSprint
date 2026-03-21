import { SubmissionStatus } from "@prisma/client";

type CaseSummary = {
  index: number;
  scope: "sample" | "hidden";
  passed: boolean;
  verdict: "PASS" | "WRONG_ANSWER" | "RUNTIME_ERROR" | "TIME_LIMIT_EXCEEDED";
};

export type FeedbackAction = "CONCEPT_CARD" | "SIMILAR_PROBLEM" | "REVIEW_QUEUE";

export type LearningFeedback = {
  failureType: "WA" | "RE" | "TLE" | "CE" | "AC";
  rootCauseCategory: string;
  action: FeedbackAction;
  message: string;
};

export function inferLearningFeedback(params: {
  status: SubmissionStatus;
  output?: string | null;
  testcaseSummary?: CaseSummary[];
  recentStatuses?: SubmissionStatus[];
}): LearningFeedback {
  const status = params.status;
  const recent = params.recentStatuses ?? [];
  const repeatedCount = recent.filter((s) => s === status).length;

  if (status === SubmissionStatus.ACCEPTED) {
    return {
      failureType: "AC",
      rootCauseCategory: "정상 통과",
      action: "SIMILAR_PROBLEM",
      message: "정답입니다. 유사 난이도 문제로 확장 학습해 개념을 고정하세요.",
    };
  }

  if (status === SubmissionStatus.COMPILATION_ERROR) {
    return {
      failureType: "CE",
      rootCauseCategory: "문법/타입/헤더 오류",
      action: "CONCEPT_CARD",
      message:
        repeatedCount >= 2
          ? "컴파일 오류가 반복됩니다. 개념 카드로 문법 포인트를 먼저 복습한 뒤 재제출하세요."
          : "컴파일 오류입니다. 에러 라인부터 최소 수정 후 다시 제출해 보세요.",
    };
  }

  if (status === SubmissionStatus.RUNTIME_ERROR) {
    const root = hasKeyword(params.output, ["out of range", "segmentation", "SIGSEGV", "null", "overflow"])
      ? "인덱스/메모리 접근 오류"
      : "예외 처리 누락 또는 경계값 처리 미흡";

    return {
      failureType: "RE",
      rootCauseCategory: root,
      action: repeatedCount >= 2 ? "REVIEW_QUEUE" : "CONCEPT_CARD",
      message:
        repeatedCount >= 2
          ? "런타임 오류가 반복됩니다. 복습 큐에 추가하고 경계값 테스트를 먼저 점검하세요."
          : "런타임 오류입니다. 입력 범위/인덱스 경계/0으로 나누기 케이스를 우선 확인하세요.",
    };
  }

  if (status === SubmissionStatus.TIME_LIMIT_EXCEEDED) {
    return {
      failureType: "TLE",
      rootCauseCategory: "시간복잡도 초과 또는 비효율 반복",
      action: "CONCEPT_CARD",
      message:
        repeatedCount >= 2
          ? "시간 초과가 반복됩니다. 복잡도 개선이 필요합니다. 개념 카드에서 O(N log N)/투포인터/해시 전략을 복습하세요."
          : "시간 초과입니다. 중첩 루프/불필요 복사를 줄이고 더 낮은 복잡도의 접근으로 바꿔보세요.",
    };
  }

  const failedCase = (params.testcaseSummary ?? []).find((item) => !item.passed);
  const root = failedCase?.scope === "sample" ? "기본 예제 해석/구현 불일치" : "숨김 반례 대응 부족";

  return {
    failureType: "WA",
    rootCauseCategory: root,
    action: repeatedCount >= 2 ? "REVIEW_QUEUE" : "SIMILAR_PROBLEM",
    message:
      repeatedCount >= 2
        ? "오답 패턴이 반복됩니다. 복습 큐에 넣고 반례를 최소 3개 직접 만든 뒤 다시 제출하세요."
        : "오답입니다. 실패한 테스트 유형을 기준으로 유사 문제 1개를 풀며 반례를 보강해 보세요.",
  };
}

export function actionLabel(action: FeedbackAction) {
  switch (action) {
    case "CONCEPT_CARD":
      return "개념 카드";
    case "SIMILAR_PROBLEM":
      return "유사 문제";
    case "REVIEW_QUEUE":
      return "복습 큐";
    default:
      return "다음 학습";
  }
}

function hasKeyword(text: string | null | undefined, keywords: string[]) {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}
