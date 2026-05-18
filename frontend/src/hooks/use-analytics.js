import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchAnalyticsOverview,
  fetchAnalyticsIssues,
  fetchAnalyticsPriorities,
  fetchAnalyticsProjects,
  fetchAnalyticsRecentActivity,
  fetchAnalyticsTeams,
  fetchAnalyticsTrends,
} from "@/lib/api";

const createAnalyticsFilters = (filters = {}) => ({
  dateFrom: filters.dateFrom || "",
  dateTo: filters.dateTo || "",
  projectId: filters.projectId || "all",
  teamId: filters.teamId || "all",
  assigneeId: filters.assigneeId || "all",
  status: filters.status || "all",
  priority: filters.priority || "all",
  type: filters.type || "all",
  search: filters.search || "",
});

export const analyticsQueryKeys = {
  root: ["analytics"],
  overview: (filters) => [...analyticsQueryKeys.root, "overview", filters],
  trends: (filters) => [...analyticsQueryKeys.root, "trends", filters],
  priorities: (filters) => [...analyticsQueryKeys.root, "priorities", filters],
  projects: (filters) => [...analyticsQueryKeys.root, "projects", filters],
  teams: (filters) => [...analyticsQueryKeys.root, "teams", filters],
  recentActivity: (filters) => [
    ...analyticsQueryKeys.root,
    "recent-activity",
    filters,
  ],
  issues: (filters) => [...analyticsQueryKeys.root, "issues", filters],
};

export const useAnalyticsOverview = (filters = {}, options = {}) => {
  const normalizedFilters = useMemo(() => createAnalyticsFilters(filters), [filters]);

  return useQuery({
    queryKey: analyticsQueryKeys.overview(normalizedFilters),
    queryFn: () => fetchAnalyticsOverview(normalizedFilters),
    staleTime: 30_000,
    ...options,
  });
};

const analyticsQueries = [
  {
    key: "overview",
    queryKey: analyticsQueryKeys.overview,
    queryFn: fetchAnalyticsOverview,
  },
  {
    key: "trends",
    queryKey: analyticsQueryKeys.trends,
    queryFn: fetchAnalyticsTrends,
  },
  {
    key: "priorities",
    queryKey: analyticsQueryKeys.priorities,
    queryFn: fetchAnalyticsPriorities,
  },
  {
    key: "projects",
    queryKey: analyticsQueryKeys.projects,
    queryFn: fetchAnalyticsProjects,
  },
  {
    key: "teams",
    queryKey: analyticsQueryKeys.teams,
    queryFn: fetchAnalyticsTeams,
  },
  {
    key: "recentActivity",
    queryKey: analyticsQueryKeys.recentActivity,
    queryFn: fetchAnalyticsRecentActivity,
  },
  {
    key: "issues",
    queryKey: analyticsQueryKeys.issues,
    queryFn: fetchAnalyticsIssues,
    optional: true,
  },
];

export const useAnalytics = (filters = {}, options = {}) => {
  const normalizedFilters = useMemo(() => createAnalyticsFilters(filters), [filters]);
  const results = useQueries({
    queries: analyticsQueries.map((query) => ({
      queryKey: query.queryKey(normalizedFilters),
      queryFn: () => query.queryFn(normalizedFilters),
      staleTime: 30_000,
      enabled:
        (options.enabled ?? true) &&
        (!query.optional || Boolean(options.includeIssues)),
    })),
  });

  return analyticsQueries.reduce(
    (analytics, query, index) => {
      const result = results[index];

      analytics[query.key] = result.data;
      analytics.isLoading = analytics.isLoading || result.isLoading;
      analytics.isFetching = analytics.isFetching || result.isFetching;
      analytics.error = analytics.error || result.error;
      analytics.results[query.key] = result;

      return analytics;
    },
    {
      filters: normalizedFilters,
      overview: null,
      trends: null,
      priorities: null,
      projects: null,
      teams: null,
      recentActivity: null,
      issues: null,
      isLoading: false,
      isFetching: false,
      error: null,
      results: {},
    }
  );
};

export default useAnalytics;
