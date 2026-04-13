export const ROLE_ADMIN = "Admin";
export const ROLE_DEVELOPER = "Developer";
export const ROLE_TESTER = "Tester";

export const dashboardPathByRole = {
  [ROLE_ADMIN]: "/admin/dashboard",
  [ROLE_DEVELOPER]: "/dev/dashboard",
  [ROLE_TESTER]: "/tester/dashboard",
};

export const getDashboardPathByRole = (role) =>
  dashboardPathByRole[role] || "/login";

export const getRoleNavigation = (role) => {
  if (role === ROLE_ADMIN) {
    return [
      { label: "Dashboard", href: dashboardPathByRole[ROLE_ADMIN], icon: "dashboard" },
      { label: "Projects", href: "/projects", icon: "projects" },
      { label: "Teams", href: "/teams", icon: "teams" },
      { label: "Issues", href: "/issues", icon: "issues" },
      { label: "Reports", href: "/reports", icon: "reports" },
      { label: "Settings", href: "/settings/users", icon: "settings" },
    ];
  }

  if (role === ROLE_TESTER) {
    return [
      { label: "Dashboard", href: dashboardPathByRole[ROLE_TESTER], icon: "dashboard" },
      { label: "Tasks", href: "/tasks", icon: "tasks" },
      { label: "Reports", href: "/reports", icon: "reports" },
    ];
  }

  return [
    { label: "Dashboard", href: dashboardPathByRole[ROLE_DEVELOPER], icon: "dashboard" },
    { label: "Tasks", href: "/tasks", icon: "tasks" },
    { label: "Reports", href: "/reports", icon: "reports" },
    { label: "Settings", href: "/dev/settings", icon: "settings" },
  ];
};

export const getPageMeta = (pathname, role) => {
  const metaByPath = {
    [dashboardPathByRole[ROLE_ADMIN]]: {
      title: "Admin Command Center",
      description: "Review users, projects, and delivery health across the full workspace.",
    },
    [dashboardPathByRole[ROLE_DEVELOPER]]: {
      title: "Developer Dashboard",
      description: "Stay focused on your assigned issues, active priorities, and release-ready work.",
    },
    "/dev/settings": {
      title: "Developer Settings",
      description: "Manage your account security and update your password with confidence.",
    },
    [dashboardPathByRole[ROLE_TESTER]]: {
      title: "Tester Dashboard",
      description: "Track validation work, move bugs through triage, and report fresh defects quickly.",
    },
    "/projects": {
      title: "Project Space",
      description: "Create projects, attach teams, and keep delivery scopes well defined.",
    },
    "/teams": {
      title: "Workspace Teams",
      description: "Organize workspace members into delivery groups and keep team membership clean.",
    },
    "/teams/create": {
      title: "Create Team",
      description: "Build a workspace-scoped team and add members from the current workspace only.",
    },
    "/tasks": {
      title: "Tasks",
      description: "Track your assigned work, move statuses forward, and stay focused on delivery.",
    },
    "/reports": {
      title: "Reports",
      description: "Review issue analytics, distribution trends, and project-level workload signals.",
    },
    "/settings/users": {
      title: "User Management",
      description: "Invite teammates, update workspace roles, and manage admin access controls.",
    },
  };

  if (pathname === "/issues") {
    if (role === ROLE_ADMIN) {
      return {
        title: "Issue Tracker",
        description: "Assign work, rebalance priorities, and manage execution from a structured issue registry.",
      };
    }

    if (role === ROLE_TESTER) {
      return {
        title: "Testing Queue",
        description: "Work through validation tasks, update bug status, and keep QA feedback visible in a clean list.",
      };
    }

    return {
      title: "My Assigned Work",
      description: "Move your issues forward, keep status fresh, and stay on top of active delivery work.",
    };
  }

  return (
    metaByPath[pathname] || {
      title: "Workspace",
      description: "Plan projects, move work, and keep the team aligned.",
    }
  );
};

export const canManageUsers = (role) => role === ROLE_ADMIN;
export const canManageProjects = (role) => role === ROLE_ADMIN;
export const canAssignIssues = (role) => role === ROLE_ADMIN;
export const canDeleteIssues = (role) => role === ROLE_ADMIN;
export const canCreateIssues = (role) =>
  role === ROLE_ADMIN || role === ROLE_TESTER;
