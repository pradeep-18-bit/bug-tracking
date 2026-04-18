import { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  MailPlus,
  ShieldCheck,
  UserCircle2,
  Users2,
  X,
} from "lucide-react";
import {
  fetchManagedUsers,
  inviteUser,
  updateUserRole,
} from "@/lib/api";
import {
  getDashboardPathByRole,
  hasAdminPanelAccess,
  WORKSPACE_ROLE_OPTIONS,
} from "@/lib/roles";
import { formatDate, getInitials } from "@/lib/utils";
import { getWorkspaceSenderResponseState } from "@/lib/workspaceSender";
import { useAuth } from "@/hooks/use-auth";
import { useEmailSettings } from "@/hooks/useEmailSettings";
import { useWorkspaceSender } from "@/hooks/useWorkspaceSender";
import EmailConfigurationCard from "@/components/settings/EmailConfigurationCard";
import ImportUsers from "@/components/settings/ImportUsers";
import WorkspaceMailSenderCard from "@/components/settings/WorkspaceMailSenderCard";
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

const getRoleBadgeVariant = (role) => {
  if (role === "Admin") {
    return "default";
  }

  if (role === "Manager") {
    return "secondary";
  }

  return "outline";
};

const USER_FILTER_KEY_ALL = "all";

const getFilterCardClasses = ({ accent, isActive }) => {
  const themeByAccent = {
    slate: {
      idle:
        "border-slate-200/80 bg-gradient-to-br from-slate-100 via-blue-50 to-white text-slate-900 shadow-[0_24px_64px_-42px_rgba(15,23,42,0.28)] hover:border-slate-300 hover:shadow-[0_28px_70px_-40px_rgba(59,130,246,0.28)]",
      active:
        "border-slate-400 bg-gradient-to-br from-slate-200 via-blue-100 to-white text-slate-950 shadow-[0_30px_80px_-34px_rgba(71,85,105,0.38)] ring-2 ring-slate-300/70",
      icon: "bg-white/80 text-slate-700 ring-1 ring-slate-200/80",
      glow: "bg-[radial-gradient(circle_at_top_right,_rgba(148,163,184,0.28),_transparent_55%)]",
    },
    blue: {
      idle:
        "border-blue-200/80 bg-gradient-to-br from-sky-100 via-blue-50 to-white text-slate-900 shadow-[0_24px_64px_-42px_rgba(37,99,235,0.28)] hover:border-blue-300 hover:shadow-[0_28px_72px_-38px_rgba(37,99,235,0.34)]",
      active:
        "border-blue-500 bg-gradient-to-br from-blue-200 via-sky-100 to-white text-slate-950 shadow-[0_32px_86px_-36px_rgba(37,99,235,0.42)] ring-2 ring-blue-300/70",
      icon: "bg-white/85 text-blue-700 ring-1 ring-blue-200/80",
      glow: "bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.3),_transparent_58%)]",
    },
    purple: {
      idle:
        "border-violet-200/80 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-white text-slate-900 shadow-[0_24px_64px_-42px_rgba(124,58,237,0.26)] hover:border-violet-300 hover:shadow-[0_28px_72px_-38px_rgba(124,58,237,0.34)]",
      active:
        "border-violet-500 bg-gradient-to-br from-violet-200 via-fuchsia-100 to-white text-slate-950 shadow-[0_32px_86px_-36px_rgba(124,58,237,0.42)] ring-2 ring-violet-300/70",
      icon: "bg-white/85 text-violet-700 ring-1 ring-violet-200/80",
      glow: "bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.32),_transparent_58%)]",
    },
    indigo: {
      idle:
        "border-indigo-200/80 bg-gradient-to-br from-indigo-100 via-indigo-50 to-white text-slate-900 shadow-[0_24px_64px_-42px_rgba(79,70,229,0.26)] hover:border-indigo-300 hover:shadow-[0_28px_72px_-38px_rgba(79,70,229,0.34)]",
      active:
        "border-indigo-500 bg-gradient-to-br from-indigo-200 via-indigo-100 to-white text-slate-950 shadow-[0_32px_86px_-36px_rgba(79,70,229,0.42)] ring-2 ring-indigo-300/70",
      icon: "bg-white/85 text-indigo-700 ring-1 ring-indigo-200/80",
      glow: "bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.32),_transparent_58%)]",
    },
    green: {
      idle:
        "border-emerald-200/80 bg-gradient-to-br from-emerald-100 via-green-50 to-white text-slate-900 shadow-[0_24px_64px_-42px_rgba(16,185,129,0.26)] hover:border-emerald-300 hover:shadow-[0_28px_72px_-38px_rgba(16,185,129,0.34)]",
      active:
        "border-emerald-500 bg-gradient-to-br from-emerald-200 via-green-100 to-white text-slate-950 shadow-[0_32px_86px_-36px_rgba(16,185,129,0.42)] ring-2 ring-emerald-300/70",
      icon: "bg-white/85 text-emerald-700 ring-1 ring-emerald-200/80",
      glow: "bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.32),_transparent_58%)]",
    },
  };

  const theme = themeByAccent[accent] || themeByAccent.slate;

  return {
    card: isActive ? theme.active : theme.idle,
    icon: theme.icon,
    glow: theme.glow,
  };
};

const UserSettingsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const redirectTimeoutRef = useRef(null);
  const workspaceSenderNoteRef = useRef("");
  const { token, user: authUser, setAuthSession } = useAuth();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Developer");
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [recentInvite, setRecentInvite] = useState(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [newRole, setNewRole] = useState("");
  const [toast, setToast] = useState(null);
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [isSenderDirty, setIsSenderDirty] = useState(false);
  const [activeUserFilter, setActiveUserFilter] = useState("");

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

  const {
    eligibleSendersQuery,
    workspaceSenderQuery,
    saveWorkspaceSenderMutation,
  } = useWorkspaceSender();

  const eligibleSenders = eligibleSendersQuery.data || [];
  const {
    workspaceSender,
    manualSelection,
    workspaceDefaultSelection,
    hasManualSender,
    hasActiveSender,
    manualSenderId,
    activeSenderId,
  } = useMemo(
    () => getWorkspaceSenderResponseState(workspaceSenderQuery.data),
    [workspaceSenderQuery.data]
  );
  const currentUserSenderProfile = useMemo(() => {
    const authUserId = String(authUser?._id || "");

    if (!authUserId) {
      return null;
    }

    return (
      eligibleSenders.find((user) => String(user._id) === authUserId) ||
      (workspaceSender?.user &&
      String(workspaceSender.user._id || "") === authUserId
        ? workspaceSender.user
        : null)
    );
  }, [authUser?._id, eligibleSenders, workspaceSender?.user]);
  const preferredSenderId =
    manualSenderId || currentUserSenderProfile?._id || activeSenderId || "";

  const {
    emailConfigQuery,
    saveEmailConfigMutation,
  } = useEmailSettings(selectedSenderId);
  const {
    emailConfigQuery: activeSenderEmailConfigQuery,
    testEmailConfigMutation: activeSenderTestEmailMutation,
  } = useEmailSettings(activeSenderId);

  useEffect(() => {
    if (
      isSenderDirty ||
      workspaceSenderQuery.isLoading ||
      eligibleSendersQuery.isLoading
    ) {
      return;
    }

    setSelectedSenderId(preferredSenderId);
  }, [
    eligibleSendersQuery.isLoading,
    isSenderDirty,
    preferredSenderId,
    workspaceSenderQuery.isLoading,
  ]);

  useEffect(() => {
    const note = workspaceSender?.note || "";

    if (!note) {
      workspaceSenderNoteRef.current = "";
      return;
    }

    if (workspaceSenderNoteRef.current === note) {
      return;
    }

    workspaceSenderNoteRef.current = note;
    showToast("warning", note);
  }, [workspaceSender?.note]);

  useEffect(() => {
    if (!selectedSenderId) {
      return;
    }

    const isStillEligible =
      eligibleSenders.some(
        (user) => String(user._id) === String(selectedSenderId)
      ) ||
      String(workspaceSender?.user?._id || "") === String(selectedSenderId);

    if (
      !isStillEligible &&
      !eligibleSendersQuery.isLoading &&
      !workspaceSenderQuery.isLoading
    ) {
      setSelectedSenderId(preferredSenderId);
      setIsSenderDirty(false);
    }
  }, [
    eligibleSenders,
    eligibleSendersQuery.isLoading,
    preferredSenderId,
    selectedSenderId,
    workspaceSender?.user?._id,
    workspaceSenderQuery.isLoading,
  ]);

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

  const selectedSender = useMemo(() => {
    const senderCandidates = [
      ...eligibleSenders,
      workspaceSender?.user,
      manualSelection?.user,
      workspaceDefaultSelection?.user,
    ].filter(Boolean);

    if (!selectedSenderId) {
      return null;
    }

    return (
      senderCandidates.find(
        (user) => String(user._id) === String(selectedSenderId)
      ) || null
    );
  }, [
    eligibleSenders,
    manualSelection?.user,
    selectedSenderId,
    workspaceDefaultSelection?.user,
    workspaceSender?.user,
  ]);
  const activeSenderEmailConfig = activeSenderEmailConfigQuery.data?.config || null;

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (data) => {
      setInviteFeedback(data.message || "User invited successfully");
      setRecentInvite(data.invitedUser || null);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["eligible-senders"] });
    },
  });

  const roleUpdateMutation = useMutation({
    mutationFn: updateUserRole,
    onSuccess: (data) => {
      const updatedUser = data.user;

      setSelectedUser(updatedUser._id);
      setCurrentRole(updatedUser.role);
      setNewRole(updatedUser.role);
      showToast(
        "success",
        [data.message, data.warning].filter(Boolean).join(" ")
      );

      const mergeUpdatedUser = (existingUsers = []) =>
        Array.isArray(existingUsers)
          ? existingUsers.map((user) =>
              user._id === updatedUser._id ? { ...user, ...updatedUser } : user
            )
          : existingUsers;

      queryClient.setQueryData(["managed-users"], mergeUpdatedUser);
      queryClient.setQueryData(["users"], mergeUpdatedUser);

      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["eligible-senders"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-sender"] });
      queryClient.invalidateQueries({ queryKey: ["email-config"] });

      const isCurrentUser = authUser?._id === updatedUser._id;
      const isLosingAdminAccess =
        isCurrentUser &&
        hasAdminPanelAccess(authUser?.role) &&
        !hasAdminPanelAccess(updatedUser.role);

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
      }
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
    const managerCount = users.filter((user) => user.role === "Manager").length;
    const developerCount = users.filter((user) => user.role === "Developer").length;
    const testerCount = users.filter((user) => user.role === "Tester").length;

    return {
      total: users.length,
      adminCount,
      managerCount,
      developerCount,
      testerCount,
    };
  }, [users]);

  const userFilterCards = useMemo(
    () => [
      {
        key: USER_FILTER_KEY_ALL,
        label: "Total Users",
        count: stats.total,
        accent: "slate",
        icon: Users2,
        description: "Browse every workspace member",
      },
      {
        key: "Admin",
        label: "Admins",
        count: stats.adminCount,
        accent: "blue",
        icon: ShieldCheck,
        description: "View workspace administrators",
      },
      {
        key: "Manager",
        label: "Managers",
        count: stats.managerCount,
        accent: "purple",
        icon: UserCircle2,
        description: "View delivery managers",
      },
      {
        key: "Developer",
        label: "Developers",
        count: stats.developerCount,
        accent: "indigo",
        icon: MailPlus,
        description: "View implementation teammates",
      },
      {
        key: "Tester",
        label: "Testers",
        count: stats.testerCount,
        accent: "green",
        icon: CheckCircle2,
        description: "View QA and validation users",
      },
    ],
    [stats]
  );
  const activeUserFilterCard = useMemo(
    () =>
      userFilterCards.find((card) => card.key === activeUserFilter) || null,
    [activeUserFilter, userFilterCards]
  );
  const filteredUsers = useMemo(() => {
    if (!activeUserFilter) {
      return [];
    }

    if (activeUserFilter === USER_FILTER_KEY_ALL) {
      return sortedUsers;
    }

    return sortedUsers.filter((user) => user.role === activeUserFilter);
  }, [activeUserFilter, sortedUsers]);
  const filteredUsersTitle = activeUserFilterCard
    ? activeUserFilterCard.key === USER_FILTER_KEY_ALL
      ? "Workspace Users"
      : activeUserFilterCard.label
    : "";
  const filteredUsersDescription = activeUserFilterCard
    ? activeUserFilterCard.key === USER_FILTER_KEY_ALL
      ? "All workspace members are shown below."
      : `Showing only ${activeUserFilterCard.label.toLowerCase()} in this workspace.`
    : "";

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

  const handleActivateSelectedSender = async () => {
    if (!selectedSenderId) {
      showToast("error", "Select a sender user before saving your active sender.");
      return;
    }

    if (!selectedSender?.smtpConfigured) {
      showToast(
        "error",
        "The selected user does not have SMTP configuration yet. Save it first."
      );
      return;
    }

    try {
      const response = await saveWorkspaceSenderMutation.mutateAsync({
        userId: selectedSenderId,
        enabled: true,
      });
      const responseWorkspaceSender = response?.workspaceSender;

      setSelectedSenderId(
        responseWorkspaceSender?.manualSelection?.userId ||
          responseWorkspaceSender?.userId ||
          selectedSenderId
      );
      setIsSenderDirty(false);

      showToast(
        "success",
        response?.message || "Active sender saved successfully."
      );
    } catch (mutationError) {
      showToast(
        "error",
        mutationError.response?.data?.message ||
          "Unable to save your active sender right now."
      );
    }
  };

  const handleClearWorkspaceSender = async () => {
    try {
      const response = await saveWorkspaceSenderMutation.mutateAsync({
        userId: "",
        enabled: false,
      });
      const responseWorkspaceSender = response?.workspaceSender;

      setSelectedSenderId(
        currentUserSenderProfile?._id ||
          responseWorkspaceSender?.workspaceDefault?.userId ||
          responseWorkspaceSender?.userId ||
          ""
      );
      setIsSenderDirty(false);

      showToast(
        "success",
        response?.message || "Active sender reset successfully."
      );
    } catch (mutationError) {
      showToast(
        "error",
        mutationError.response?.data?.message ||
          "Unable to save your active sender right now."
      );
    }
  };

  const handleTestActiveSender = async () => {
    if (!activeSenderId || !workspaceSender?.user?.smtpConfigured) {
      showToast(
        "error",
        workspaceSender?.source === "global-default"
          ? "The current sender is using the global fallback, so there is no saved user SMTP profile to test."
          : "The active sender needs SMTP setup before sending a test email."
      );
      return;
    }

    if (!activeSenderEmailConfig) {
      showToast("error", "Unable to load the active sender SMTP configuration.");
      return;
    }

    try {
      const response = await activeSenderTestEmailMutation.mutateAsync({
        userId: activeSenderId,
        host: activeSenderEmailConfig.host,
        port: activeSenderEmailConfig.port,
        secure: activeSenderEmailConfig.secure,
        username: activeSenderEmailConfig.username,
        password: "",
        fromName: activeSenderEmailConfig.fromName,
        fromEmail: activeSenderEmailConfig.fromEmail,
      });

      showToast("success", response?.message || "Test email sent successfully.");
    } catch (mutationError) {
      showToast(
        "error",
        mutationError.response?.data?.message ||
          "Unable to send a test email right now."
      );
    }
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            {userFilterCards.map((card) => {
              const Icon = card.icon;
              const isActive = activeUserFilter === card.key;
              const classes = getFilterCardClasses({
                accent: card.accent,
                isActive,
              });

              return (
                <button
                  key={card.key}
                  type="button"
                  className={`group relative overflow-hidden rounded-[30px] border p-5 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] ${classes.card}`}
                  onClick={() => setActiveUserFilter(card.key)}
                  aria-pressed={isActive}
                >
                  <div className={`pointer-events-none absolute inset-0 ${classes.glow}`} />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${classes.icon}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      {isActive ? (
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm">
                          Active
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-8">
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600/90">
                        {card.label}
                      </p>
                      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                        {card.count}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </section>

      {!isLoading ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>Click a summary card to explore users by category.</span>
          {activeUserFilter ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setActiveUserFilter("")}
            >
              <X className="h-3.5 w-3.5" />
              Close User View
            </button>
          ) : null}
        </div>
      ) : null}

      {activeUserFilter ? (
        <Card className="shadow-[0_24px_64px_-42px_rgba(15,23,42,0.28)]">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{filteredUsersTitle}</CardTitle>
              <CardDescription>
                {filteredUsersDescription} {filteredUsers.length} user
                {filteredUsers.length === 1 ? "" : "s"} found.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                Active filter
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveUserFilter("")}
              >
                <X className="h-4 w-4" />
                Close View
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length ? (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-gray-200 bg-gray-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
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
                      <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                      <span className="text-xs text-gray-500">
                        Added {formatDate(user.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={`No ${activeUserFilterCard?.label?.toLowerCase() || "users"} found`}
                description="Invite or import teammates to populate this category."
                icon={<Users2 className="h-5 w-5" />}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-[0_24px_64px_-42px_rgba(15,23,42,0.28)]">
          <CardHeader>
            <CardTitle>Invite User</CardTitle>
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
                  {WORKSPACE_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <Button className="w-full" type="submit" disabled={inviteMutation.isPending}>
                <MailPlus className="h-4 w-4" />
                {inviteMutation.isPending ? "Inviting..." : "Invite User"}
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

        <Card className="shadow-[0_24px_64px_-42px_rgba(15,23,42,0.28)]">
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
                  {WORKSPACE_ROLE_OPTIONS.map((role) => (
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

      <section className="space-y-6">
        <WorkspaceMailSenderCard
          currentUser={authUser}
          currentWorkspaceSender={workspaceSender}
          eligibleSenders={eligibleSenders}
          errorMessage={
            eligibleSendersQuery.error?.response?.data?.message ||
            workspaceSenderQuery.error?.response?.data?.message ||
            ""
          }
          isLoading={eligibleSendersQuery.isLoading || workspaceSenderQuery.isLoading}
          isSaving={saveWorkspaceSenderMutation.isPending}
          isTesting={activeSenderTestEmailMutation.isPending}
          canSendTestMail={Boolean(
            activeSenderId &&
              workspaceSender?.user?.smtpConfigured &&
              activeSenderEmailConfig &&
              !activeSenderEmailConfigQuery.isLoading
          )}
          selectedSenderId={selectedSenderId}
          onSelectedSenderChange={(value) => {
            setSelectedSenderId(value);
            setIsSenderDirty(true);
          }}
          onSendTestMail={handleTestActiveSender}
          onActivateSelected={handleActivateSelectedSender}
          onClearSender={handleClearWorkspaceSender}
        />

        <EmailConfigurationCard
          currentWorkspaceSender={workspaceSender}
          emailConfigQuery={emailConfigQuery}
          saveEmailConfigMutation={saveEmailConfigMutation}
          selectedSender={selectedSender}
          showToast={showToast}
        />
      </section>

      <ImportUsers
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["managed-users"] });
          queryClient.invalidateQueries({ queryKey: ["users"] });
          queryClient.invalidateQueries({ queryKey: ["eligible-senders"] });
        }}
      />
    </div>
  );
};

export default UserSettingsPage;
