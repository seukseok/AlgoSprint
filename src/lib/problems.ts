import { Problem } from "./types";

export const problems: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    tags: ["array", "hash-table"],
    summary: "Find two indices such that nums[i] + nums[j] == target.",
    statement:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Assume exactly one solution and that you may not use the same element twice.",
    sampleInput: "nums = [2,7,11,15], target = 9",
    sampleOutput: "[0,1]",
    starterCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  // TODO: implement solution\n  cout << \"Hello, AlgoSprint!\\n\";\n  return 0;\n}\n`,
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    tags: ["stack", "string"],
    summary: "Determine whether a string has valid matching brackets.",
    statement:
      "Given a string containing just characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    sampleInput: "s = \"()[]{}\"",
    sampleOutput: "true",
    starterCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nbool isValid(const string& s) {\n  // TODO\n  return true;\n}\n\nint main() {\n  string s;\n  cin >> s;\n  cout << (isValid(s) ? \"true\" : \"false\") << '\\n';\n  return 0;\n}\n`,
  },
  {
    id: "longest-increasing-subsequence",
    title: "Longest Increasing Subsequence",
    difficulty: "Medium",
    tags: ["dp", "binary-search"],
    summary: "Return the length of the longest strictly increasing subsequence.",
    statement:
      "Given an integer array nums, return the length of the longest strictly increasing subsequence.",
    sampleInput: "nums = [10,9,2,5,3,7,101,18]",
    sampleOutput: "4",
    starterCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nint lengthOfLIS(vector<int>& nums) {\n  // TODO\n  return 0;\n}\n\nint main() {\n  vector<int> nums = {10,9,2,5,3,7,101,18};\n  cout << lengthOfLIS(nums) << '\\n';\n  return 0;\n}\n`,
  },
];

export function findProblem(id: string) {
  return problems.find((problem) => problem.id === id);
}
