const SAFE_MODE = process.env.NEXT_PUBLIC_RUNNER_SAFE_MODE === "1";

export function SafeModeBanner() {
  if (!SAFE_MODE) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
      안전 모드 활성화: 채점 러너가 제한 모드로 동작하며 운영자 설정에 따라 일부 기능이 제한될 수 있습니다.
    </div>
  );
}
