export const getDeveloperBugBucketQueryKey = (userId) => [
  "issues",
  "bucket",
  "available",
  String(userId || ""),
];

export const getDeveloperBugBucketQueryFilters = () => ({
  sortBy: "priority",
});

export const removeIssueFromBucketCaches = (queryClient, issueId) => {
  if (!issueId) {
    return;
  }

  queryClient.setQueriesData(
    {
      predicate: (query) =>
        query.queryKey?.[0] === "issues" && query.queryKey?.[1] === "bucket",
    },
    (current = []) =>
      Array.isArray(current)
        ? current.filter((issue) => issue?._id !== issueId)
        : current
  );
};
