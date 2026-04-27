import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  fetchManagedUsers,
  inviteUser,
  updateUserRole,
} from "@/lib/api";
import {
  getDashboardPathByRole,
  hasAdminPanelAccess,
} from "@/lib/roles";
import { getWorkspaceSenderResponseState } from "@/lib/workspaceSender";
import { useAuth } from "@/hooks/use-auth";
import { useEmailSettings } from "@/hooks/useEmailSettings";
import { useWorkspaceSender } from "@/hooks/useWorkspaceSender";
import AdminSettingsLayout from "@/components/settings/AdminSettingsLayout";
import ImportUsersCSVSettings from "@/components/settings/ImportUsersCSVSettings";
import InviteUserSettings from "@/components/settings/InviteUserSettings";
import ModifyRoleSettings from "@/components/settings/ModifyRoleSettings";
import SMTPConfigurationSettings from "@/components/settings/SMTPConfigurationSettings";
import UsersSettings from "@/components/settings/UsersSettings";
import WorkspaceMailSenderSettings from "@/components/settings/WorkspaceMailSenderSettings";
import ToastNotice from "@/components/shared/ToastNotice";
import { Card, CardContent } from "@/components/ui/card";

const SETTINGS_ITEMS = [
  { id: "users", label: "Users" },
  { id: "invite", label: "Invite User" },
  { id: "roles", label: "Modify User Role" },
  { id: "sender", label: "Workspace Mail Sender" },
  { id: "smtp", label: "SMTP Configuration" },
  { id: "import", label: "Import Users from CSV" },
];

const DEFAULT_SETTINGS_ITEM = "users";
const USER_FILTER_KEY_ALL = "all";

const UserSettingsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const redirectTimeoutRef = useRef(null);
  const workspaceSenderNoteRef = useRef("");
  const { token, user: authUser, setAuthSession } = useAuth();

  const [activeSettingsItem, setActiveSettingsItem] = useState(DEFAULT_SETTINGS_ITEM);
  const [activeUserFilter, setActiveUserFilter] = useState(USER_FILTER_KEY_ALL);
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

  const renderActiveSettingsItem = () => {
    if (activeSettingsItem === "invite") {
      return (
        <InviteUserSettings
          feedback={inviteFeedback}
          inviteEmail={inviteEmail}
          inviteMutation={inviteMutation}
          inviteRole={inviteRole}
          onEmailChange={setInviteEmail}
          onRoleChange={setInviteRole}
          onSubmit={handleInviteSubmit}
          recentInvite={recentInvite}
        />
      );
    }

    if (activeSettingsItem === "roles") {
      return (
        <ModifyRoleSettings
          currentRole={currentRole}
          isLoading={isLoading}
          isRoleUpdateDisabled={isRoleUpdateDisabled}
          newRole={newRole}
          onNewRoleChange={setNewRole}
          onRoleSelectionChange={handleRoleSelectionChange}
          onSubmit={handleRoleUpdateSubmit}
          roleUpdateMutation={roleUpdateMutation}
          selectedUser={selectedUser}
          selectedUserOption={selectedUserOption}
          userOptions={userOptions}
          users={users}
        />
      );
    }

    if (activeSettingsItem === "sender") {
      return (
        <WorkspaceMailSenderSettings
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
      );
    }

    if (activeSettingsItem === "smtp") {
      return (
        <SMTPConfigurationSettings
          currentWorkspaceSender={workspaceSender}
          emailConfigQuery={emailConfigQuery}
          saveEmailConfigMutation={saveEmailConfigMutation}
          selectedSender={selectedSender}
          showToast={showToast}
        />
      );
    }

    if (activeSettingsItem === "import") {
      return (
        <ImportUsersCSVSettings
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ["managed-users"] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["eligible-senders"] });
          }}
        />
      );
    }

    return (
      <UsersSettings
        activeFilter={activeUserFilter}
        isLoading={isLoading}
        onActiveFilterChange={setActiveUserFilter}
        users={users}
      />
    );
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

      <AdminSettingsLayout
        activeItem={activeSettingsItem}
        items={SETTINGS_ITEMS}
        onActiveItemChange={setActiveSettingsItem}
      >
        {renderActiveSettingsItem()}
      </AdminSettingsLayout>
    </div>
  );
};

export default UserSettingsPage;
