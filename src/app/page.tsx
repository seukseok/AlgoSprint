import { EditorWorkspace } from "@/components/editor-workspace";

const starterCode = `#include <bits/stdc++.h>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  // 여기에 코드를 작성하세요.

  return 0;
}
`;

export default function CompilerPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">AlgoSprint BOJ 컴파일러</h1>
        <p className="text-sm text-black/70 dark:text-white/70">BOJ 풀이를 빠르게 실험하는 단일 목적 C++ 컴파일러</p>
      </div>
      <EditorWorkspace starterCode={starterCode} />
    </section>
  );
}
