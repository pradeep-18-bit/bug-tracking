import { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  MailPlus,
  ShieldCheck,
  UserCircle2,
  Users2,
} from "lucide-react";
import {
  fetchManagedUsers,
  inviteUser,
  updateUserRole,
} from "@/lib/api";
import { getDashboardPathByRole } from "@/lib/roles";
import { formatDate, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import ImportUsers from "@/components/settings/ImportUsers";
import EmptyState from "@/components/shared/EmptyState";
import ToastNotice from "@/components/shared/ToastNotice";
import {
  formatMemberOptionLabel,
  memberSelectStyles,
} from "@/components/projects/memberSelectTheme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const roleOptions = ["Admin", "Developer", "Tester"];

const CredentialsPreview = ({ title, entries = [], helperText }) => {
  if (!entries.length) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
      <p className="text-sm font-semibold text-emerald-900">{title}</p>
      {helperText ? (
        <p className="mt-1 text-xs leading-5 text-emerald-700">{helperText}</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.email}
            className="rounded-[20px] border border-emerald-200 bg-white/80 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{entry.email}</p>
                <p className="mt-1 text-xs text-gray-500">{entry.role}</p>
              </div>
              <code className="rounded-xl bg-slate-900 px-2.5 py-1.5 text-xs text-white">
                {entry.temporaryPassword}
              </code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatUserRoleOptionLabel = (option, meta) => {
  if (meta.context === "menu") {
    return formatMemberOptionLabel(option, meta);
  }

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900">{option.label}</p>
      <p className="truncate text-xs text-slate-500">{option.email}</p>
    </div>
  );
};

const UserSettingsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const redirectTimeoutRef = useRef(null);
  const { token, user: authUser, setAuthSession } = useAuth();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Developer");
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [recentInvite, setRecentInvite] = useState(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [newRole, setNewRole] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({
      id: Date.now(),
      type,
      message,
    });
  };

  useEffect(() => {
    if (!toast?.id) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3600);

    return () => window.clearTimeout(timer);
  }, [toast?.id]);

  useEffect(
    () => () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    },
    []
  );

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["managed-users"],
    queryFn: fetchManagedUsers,
  });

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => (left.name || "").localeCompare(right.name || "")),
    [users]
  );

  const userOptions = useMemo(
    () =>
      sortedUsers.map((user) => ({
        value: user._id,
        label: user.name,
        email: user.email,
        role: user.role,
      })),
    [sortedUsers]
  );

  const selectedUserOption = useMemo(
    () => userOptions.find((option) => option.value === selectedUser) || null,
    [selectedUser, userOptions]
  );

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (data) => {
      setInviteFeedback(data.message || "User invited successfully");
      setRecentInvite(data.invitedUser || null);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const roleUpdateMutation = useMutation({
    mutationFn: updateUserRole,
    onSuccess: (data) => {
      const updatedUser = data.user;

      setSelectedUser(updatedUser._id);
      setCurrentRole(updatedUser.role);
      setNewRole(updatedUser.role);
      showToast("success", data.message || "Role updated successfully");

      const mergeUpdatedUser = (existingUsers = []) =>
        Array.isArray(existingUsers)
          ? existingUsers.map((user) =>
              user._id === updatedUser._id ? { ...user, ...updatedUser } : user
            )
          : existingUsers;

      queryClient.setQueryData(["managed-users"], mergeUpdatedUser);
      queryClient.setQueryData(["users"], mergeUpdatedUser);

      const isCurrentUser = authUser?._id === updatedUser._id;
      const isLosingAdminAccess =
        isCurrentUser && authUser?.role === "Admin" && updatedUser.role !== "Admin";

      if (isLosingAdminAccess) {
        redirectTimeoutRef.current = window.setTimeout(() => {
          setAuthSession({
            token,
            user: {
              ...authUser,
              ...updatedUser,
            },
          });
          navigate(getDashboardPathByRole(updatedUser.role), {
            replace: true,
          });
        }, 900);

        return;
      }

      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (mutationError) => {
      showToast(
        "error",
        mutationError.response?.data?.message ||
          "Unable to update this user's role right now."
      );
    },
  });

  const stats = useMemo(() => {
    const adminCount = users.filter((user) => user.role === "Admin").length;
    const developerCount = users.filter((user) => user.role === "Developer").length;
    const testerCount = users.filter((user) => user.role === "Tester").length;

    return {
      total: users.length,
      adminCount,
      developerCount,
      testerCount,
    };
  }, [users]);

  const isRoleUpdateDisabled =
    roleUpdateMutation.isPending ||
    !selectedUser ||
    !currentRole ||
    !newRole ||
    currentRole === newRole;

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    setInviteFeedback("");
    setRecentInvite(null);

    try {
      await inviteMutation.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
    } catch (mutationError) {
      return mutationError;
    }

    return undefined;
  };

  const handleRoleSelectionChange = (option) => {
    setSelectedUser(option?.value || "");
    setCurrentRole(option?.role || "");
    setNewRole(option?.role || "");
  };

  const handleRoleUpdateSubmit = async (event) => {
    event.preventDefault();

    if (!selectedUser) {
      showToast("error", "Select a user before updating a role.");
      return;
    }

    if (!newRole) {
      showToast("error", "Choose a new role to continue.");
      return;
    }

    if (newRole === currentRole) {
      showToast("error", "Choose a different role before updating.");
      return;
    }

    try {
      await roleUpdateMutation.mutateAsync({
        id: selectedUser,
        role: newRole,
      });
    } catch (mutationError) {
      return mutationError;
    }

    return undefined;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700">
          {error.response?.data?.message || "Unable to load user settings."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ToastNotice toast={toast} onDismiss={() => setToast(null)} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <Users2 className="h-5 w-5 text-blue-600" />
                  <span>Total users</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <ShieldCheck className="h-5 w-5 text-sky-600" />
                  <span>Admins</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {stats.adminCount}
                </p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <MailPlus className="h-5 w-5 text-indigo-500" />
                  <span>Developers</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {stats.developerCount}
                </p>
              </CardContent>
            </Card>
            <Card className="stats-tile">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <UserCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>Testers</span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-gray-900">
                  {stats.testerCount}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invite user</CardTitle>
            <CardDescription>
              Create a workspace account for one teammate and assign their role upfront.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleInviteSubmit}>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">Email</span>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">Role</span>
                <select
                  className="field-select"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <Button className="w-full" type="submit" disabled={inviteMutation.isPending}>
                <MailPlus className="h-4 w-4" />
                {inviteMutation.isPending ? "Inviting..." : "Invite user"}
              </Button>
            </form>

            {inviteMutation.isError ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                {inviteMutation.error?.response?.data?.message ||
                  "Unable to invite this user right now."}
              </div>
            ) : null}

            {inviteFeedback ? (
              <div className="rounded-[24px] border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-800">
                {inviteFeedback}
              </div>
            ) : null}

            <CredentialsPreview
              title="Temporary credential"
              entries={recentInvite ? [recentInvite] : []}
              helperText="Share this password securely with the invited user so they can sign in and reset it later."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modify User Role</CardTitle>
            <CardDescription>
              Update roles of existing workspace users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleRoleUpdateSubmit}>
              {!users.length && !isLoading ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
                  Invite or import users before modifying workspace roles.
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  Select User
                </span>
                <Select
                  inputId="user-role-selector"
                  isClearable
                  isDisabled={isLoading || !userOptions.length || roleUpdateMutation.isPending}
                  options={userOptions}
                  value={selectedUserOption}
                  styles={memberSelectStyles}
                  formatOptionLabel={formatUserRoleOptionLabel}
                  onChange={handleRoleSelectionChange}
                  placeholder={
                    isLoading
                      ? "Loading workspace users..."
                      : userOptions.length
                        ? "Search by name or email"
                        : "No workspace users available"
                  }
                  noOptionsMessage={() =>
                    userOptions.length
                      ? "No users match your search."
                      : "No workspace users are available."
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  Current Role
                </span>
                <Input value={currentRole} placeholder="Select a user first" disabled />
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  New Role
                </span>
                <select
                  className="field-select"
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value)}
                  disabled={!selectedUser || roleUpdateMutation.isPending}
                >
                  <option value="" disabled>
                    Select a role
                  </option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <Button className="w-full" type="submit" disabled={isRoleUpdateDisabled}>
                <ShieldCheck className="h-4 w-4" />
                {roleUpdateMutation.isPending ? "Updating..." : "Update Role"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <ImportUsers
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["managed-users"] });
          queryClient.invalidateQueries({ queryKey: ["users"] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Workspace users</CardTitle>
          <CardDescription>
            Review current users, roles, and account creation dates in one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : users.length ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-gray-200 bg-gray-50 p-4 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {user.name}
                      </p>
                      <p className="truncate text-sm text-gray-600">{user.email}</p>
                      {user.employeeId || user.designation ? (
                        <p className="truncate text-xs text-gray-500">
                          {[user.employeeId, user.designation].filter(Boolean).join(" | ")}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={user.role === "Admin" ? "default" : "outline"}>
                      {user.role}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Added {formatDate(user.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No users found"
              description="Imported or invited teammates will appear here once the first account is created."
              icon={<Users2 className="h-5 w-5" />}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserSettingsPage;
