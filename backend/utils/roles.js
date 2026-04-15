const ROLE_ADMIN = "Admin";
const ROLE_MANAGER = "Manager";
const ROLE_DEVELOPER = "Developer";
const ROLE_TESTER = "Tester";

const USER_ROLE_OPTIONS = [
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_DEVELOPER,
  ROLE_TESTER,
];

const ADMIN_ACCESS_ROLES = [ROLE_ADMIN, ROLE_MANAGER];

const hasAdminAccess = (role) => ADMIN_ACCESS_ROLES.includes(role);

const isEligibleWorkspaceSenderRole = hasAdminAccess;

module.exports = {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_DEVELOPER,
  ROLE_TESTER,
  USER_ROLE_OPTIONS,
  ADMIN_ACCESS_ROLES,
  hasAdminAccess,
  isEligibleWorkspaceSenderRole,
};
