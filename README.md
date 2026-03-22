# AlgoSprint BOJ 컴파일러

BOJ 풀이를 옆에 두고 사용하는 단일 목적 웹 컴파일러입니다.

## 핵심 기능

- C++ 편집기 (Monaco)
- 액션 버튼 + 단축키
  - 컴파일: `Ctrl/Cmd + Shift + B`
  - 실행: `Ctrl/Cmd + Enter`
  - 디버그: `F5`
  - 제출 준비: `Ctrl/Cmd + S`
- 테마 선택
  - GitHub 다크
  - VS Code 다크
  - VS Code 라이트
- stdin 입력/출력 패널
- BOJ 컴패니언 패널
  - BOJ 문제 URL 입력
  - 새 탭 열기
  - 코드 복사
  - 예제 입력 임시 붙여넣기 후 stdin 반영
  - iframe 차단(X-Frame-Options/CSP) 가능 시 안내 메시지 + 새 탭 fallback

## 실행

```bash
npm install
npm run dev
```

## API

- `POST /api/execute`
  - compile / run / debug 실행
- `POST /api/submissions`
  - 제출 전 컴파일 확인 후 "BOJ에 직접 제출" 안내
- `GET /api/health`
  - 상태 확인

## 주의

이 프로젝트는 BOJ 계정 자동 제출을 수행하지 않습니다.
최종 제출은 BOJ 사이트에서 직접 진행해야 합니다.
