import { Problem } from "./types";

export const problemCatalog: Problem[] = [
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
    starterCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  // TODO: read n, array, target and print two indices\n  cout << \"0 1\\n\";\n  return 0;\n}\n`,
    sampleTests: [
      { input: "4\n2 7 11 15\n9\n", output: "0 1\n" },
      { input: "4\n3 2 4 8\n6\n", output: "1 2\n" },
    ],
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
    starterCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nbool isValid(const string& s) {\n  stack<char> st;\n  for (char c : s) {\n    if (c == '(' || c == '[' || c == '{') st.push(c);\n    else {\n      if (st.empty()) return false;\n      char top = st.top(); st.pop();\n      if ((c == ')' && top != '(') || (c == ']' && top != '[') || (c == '}' && top != '{')) return false;\n    }\n  }\n  return st.empty();\n}\n\nint main() {\n  string s;\n  cin >> s;\n  cout << (isValid(s) ? \"true\" : \"false\") << '\\n';\n  return 0;\n}\n`,
    sampleTests: [
      { input: "()[]{}\n", output: "true\n" },
      { input: "(]\n", output: "false\n" },
    ],
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
    starterCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nint lengthOfLIS(vector<int>& nums) {\n  vector<int> dp;\n  for (int x : nums) {\n    auto it = lower_bound(dp.begin(), dp.end(), x);\n    if (it == dp.end()) dp.push_back(x);\n    else *it = x;\n  }\n  return (int)dp.size();\n}\n\nint main() {\n  int n;\n  cin >> n;\n  vector<int> nums(n);\n  for (int i = 0; i < n; i++) cin >> nums[i];\n  cout << lengthOfLIS(nums) << '\\n';\n  return 0;\n}\n`,
    sampleTests: [
      { input: "8\n10 9 2 5 3 7 101 18\n", output: "4\n" },
      { input: "6\n0 1 0 3 2 3\n", output: "4\n" },
    ],
  },
];
