export const ROLE_ADMIN = "Admin";
export const ROLE_MANAGER = "Manager";
export const ROLE_DEVELOPER = "Developer";
export const ROLE_TESTER = "Tester";

export const WORKSPACE_ROLE_OPTIONS = [
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_DEVELOPER,
  ROLE_TESTER,
];

export const ADMIN_PANEL_ROLES = [ROLE_ADMIN, ROLE_MANAGER];

export const hasAdminPanelAccess = (role) => ADMIN_PANEL_ROLES.includes(role);

export const dashboardPathByRole = {
  [ROLE_ADMIN]: "/admin/dashboard",
  [ROLE_MANAGER]: "/admin/dashboard",
  [ROLE_DEVELOPER]: "/dev/dashboard",
  [ROLE_TESTER]: "/tester/dashboard",
};

export const getDashboardPathByRole = (role) =>
  dashboardPathByRole[role] || "/login";

export const getRoleNavigation = (role) => {
  if (hasAdminPanelAccess(role)) {
    return [
      { label: "Dashboard", href: dashboardPathByRole[ROLE_ADMIN], icon: "dashboard" },
      { label: "Projects", href: "/projects", icon: "projects" },
      { label: "Teams", href: "/teams", icon: "teams" },
      { label: "Backlog", href: "/backlog", icon: "backlog" },
      { label: "Issues", href: "/issues", icon: "issues" },
      { label: "Reports", href: "/reports", icon: "reports" },
      { label: "Settings", href: "/settings/users", icon: "settings" },
    ];
  }

  if (role === ROLE_TESTER) {
    return [
      { label: "Dashboard", href: dashboardPathByRole[ROLE_TESTER], icon: "dashboard" },
      { label: "Backlog", href: "/backlog", icon: "backlog" },
      { label: "Tasks", href: "/tasks", icon: "tasks" },
      { label: "Reports", href: "/reports", icon: "reports" },
    ];
  }

  return [
    { label: "Dashboard", href: dashboardPathByRole[ROLE_DEVELOPER], icon: "dashboard" },
    { label: "Backlog", href: "/backlog", icon: "backlog" },
    { label: "Tasks", href: "/tasks", icon: "tasks" },
    { label: "Reports", href: "/reports", icon: "reports" },
    { label: "Settings", href: "/dev/settings", icon: "settings" },
  ];
};

export const getPageMeta = (pathname, role) => {
  const metaByPath = {
    [dashboardPathByRole[ROLE_ADMIN]]: {
      title: "Admin Command Center",
      description:
        "Review users, projects, and delivery health across the full workspace.",
    },
    [dashboardPathByRole[ROLE_DEVELOPER]]: {
      title: "Developer Dashboard",
      description:
        "Stay focused on your assigned work items, active priorities, and release-ready delivery.",
    },
    "/dev/settings": {
      title: "Developer Settings",
      description:
        "Manage your account security and update your password with confidence.",
    },
    [dashboardPathByRole[ROLE_TESTER]]: {
      title: "Tester Dashboard",
      description:
        "Track validation work, move bugs through triage, and keep QA signals visible across delivery.",
    },
    "/projects": {
      title: "Project Space",
      description:
        "Create projects, attach teams, and keep delivery scopes well defined.",
    },
    "/teams": {
      title: "Workspace Teams",
      description:
        "Organize workspace members into delivery groups and keep team membership clean.",
    },
    "/backlog": {
      title: "Backlog Planning",
      description:
        "Plan sprint work, organize epics, and keep backlog priorities aligned before execution starts.",
    },
    "/teams/create": {
      title: "Create Team",
      description:
        "Build a workspace-scoped team and add members from the current workspace only.",
    },
    "/tasks": {
      title: "Tasks",
      description:
        "Track your assigned work, move statuses forward, and stay focused on delivery.",
    },
    "/reports": {
      title: "Reports",
      description:
        "Review work item analytics, distribution trends, and project-level workload signals.",
    },
    "/settings/users": {
      title: "User Management",
      description:
        "Invite teammates, update workspace roles, configure mail senders, and manage workspace access controls.",
    },
  };

  if (pathname === "/issues") {
    if (hasAdminPanelAccess(role)) {
      return {
        title: "Issue Workspace",
        description:
          "Filter work across projects, rebalance priorities, and move items through a structured delivery workflow.",
      };
    }

    if (role === ROLE_TESTER) {
      return {
        title: "Testing Queue",
        description:
          "Work through validation tasks, update bug status, and keep QA feedback visible in a structured queue.",
      };
    }

    return {
      title: "My Assigned Work",
      description:
        "Move your assigned work forward, keep status fresh, and stay on top of active delivery work.",
    };
  }

  return (
    metaByPath[pathname] || {
      title: "Workspace",
      description: "Plan projects, move work, and keep the team aligned.",
    }
  );
};

export const canManageUsers = (role) => hasAdminPanelAccess(role);
export const canManageProjects = (role) => hasAdminPanelAccess(role);
export const canAssignIssues = (role) => hasAdminPanelAccess(role);
export const canDeleteIssues = (role) => hasAdminPanelAccess(role);
export const canCreateIssues = (role) =>
  hasAdminPanelAccess(role) || role === ROLE_TESTER;
