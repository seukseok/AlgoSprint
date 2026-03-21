export type InternalTestcase = {
  input: string;
  output: string;
};

export const hiddenTestCatalog: Record<string, InternalTestcase[]> = {
  "two-sum": [
    { input: "5\n1 4 6 8 10\n14\n", output: "1 4\n" },
    { input: "4\n-3 1 7 9\n6\n", output: "0 3\n" },
  ],
  "valid-parentheses": [
    { input: "([{}])\n", output: "true\n" },
    { input: "([)]\n", output: "false\n" },
  ],
  "longest-increasing-subsequence": [
    { input: "6\n1 2 3 4 5 6\n", output: "6\n" },
    { input: "7\n9 8 7 1 2 3 0\n", output: "3\n" },
  ],
  "prefix-sum-range": [
    { input: "5 3\n5 4 3 2 1\n1 5\n2 4\n3 3\n", output: "15\n9\n3\n" },
    { input: "4 2\n1000000000 1000000000 1000000000 1000000000\n1 4\n2 3\n", output: "4000000000\n2000000000\n" },
  ],
  "meeting-room-greedy": [
    { input: "5\n1 2\n2 3\n3 4\n0 10\n4 5\n", output: "4\n" },
    { input: "4\n1 4\n2 3\n3 4\n4 5\n", output: "3\n" },
  ],
  "two-pointers-pair-count": [
    { input: "8\n1 1 2 2 3 3 4 4\n5\n", output: "4\n" },
    { input: "6\n-2 -1 0 1 2 3\n1\n", output: "3\n" },
  ],
  "binary-search-lower-bound": [
    { input: "6\n1 2 2 2 3 5\n2\n", output: "1\n" },
    { input: "5\n1 4 7 9 10\n11\n", output: "-1\n" },
  ],
  "grid-bfs-shortest": [
    { input: "3 4\n0000\n1110\n0000\n", output: "5\n" },
    { input: "3 3\n010\n111\n010\n", output: "-1\n" },
  ],
  "connected-components-dfs": [
    { input: "6 3\n1 2\n2 3\n5 6\n", output: "3\n" },
    { input: "5 4\n1 2\n2 3\n3 4\n4 5\n", output: "1\n" },
  ],
  "tree-diameter-double-bfs": [
    { input: "6\n1 2\n2 3\n3 4\n4 5\n5 6\n", output: "5\n" },
    { input: "7\n1 2\n1 3\n1 4\n4 5\n5 6\n6 7\n", output: "5\n" },
  ],
  "coin-change-min": [
    { input: "3 11\n1 5 7\n", output: "3\n" },
    { input: "2 8\n5 6\n", output: "-1\n" },
  ],
  "knapsack-01": [
    { input: "4 7\n6 13\n4 8\n3 6\n5 12\n", output: "14\n" },
    { input: "3 10\n3 6\n4 7\n5 8\n", output: "15\n" },
  ],
  "interval-scheduling-count": [
    { input: "5\n1 2\n2 3\n3 4\n1 4\n4 5\n", output: "4\n" },
    { input: "4\n1 10\n2 3\n3 4\n4 5\n", output: "3\n" },
  ],
  "sliding-window-min-length": [
    { input: "8 15\n1 2 3 4 5 6 7 8\n", output: "2\n" },
    { input: "5 11\n1 2 3 4 5\n", output: "3\n" },
  ],
  "parametric-router-install": [
    { input: "5 3\n1\n2\n8\n12\n17\n", output: "7\n" },
    { input: "6 4\n1\n3\n7\n9\n13\n20\n", output: "6\n" },
  ],
  "dijkstra-basic": [
    { input: "4 4 1\n1 2 1\n2 3 2\n1 4 10\n3 4 3\n", output: "0 1 3 6\n" },
    { input: "5 3 2\n2 3 4\n2 4 1\n4 5 1\n", output: "INF 0 4 1 2\n" },
  ],
  "floyd-warshall-mini": [
    { input: "3 4\n1 2 2\n2 1 1\n2 3 5\n1 3 10\n", output: "0 2 7\n1 0 5\nINF INF 0\n" },
    { input: "2 0\n", output: "0 INF\nINF 0\n" },
  ],
  "topological-sort-order": [
    { input: "5 4\n1 2\n2 3\n3 4\n4 5\n", output: "1 2 3 4 5\n" },
    { input: "4 3\n1 2\n2 3\n3 4\n", output: "1 2 3 4\n" },
  ],
  "bfs-maze-with-break": [
    { input: "3 3\n010\n111\n000\n", output: "4\n" },
    { input: "4 4\n0000\n1110\n0010\n0000\n", output: "6\n" },
  ],
};
