import { useState } from "react";
import Select from "react-select";
import {
  LoaderCircle,
  Mail,
  MailCheck,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import {
  formatMemberOptionLabel,
  memberSelectStyles,
} from "@/components/projects/memberSelectTheme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const senderSelectStyles = {
  ...memberSelectStyles,
  control: (base, state) => ({
    ...memberSelectStyles.control(base, state),
    minHeight: 52,
    borderRadius: 20,
  }),
};

const formatSenderOptionLabel = (option, meta) => {
  if (meta.context === "menu") {
    return formatMemberOptionLabel(option, meta);
  }

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900">{option.label}</p>
      <p className="truncate text-xs text-slate-500">
        {[option.role, option.email].filter(Boolean).join(" | ")}
      </p>
    </div>
  );
};

const SummaryRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
      {label}
    </span>
    <span className="text-right text-sm font-medium text-slate-900">{value}</span>
  </div>
);

const getSourceStatusLabel = (source) => {
  if (source === "manual") {
    return "Manual sender saved";
  }

  if (source === "workspace-default") {
    return "Using workspace default";
  }

  return "Active";
};

const getSourceBadgeLabel = (source) => {
  if (source === "manual") {
    return "Manual sender";
  }

  if (source === "workspace-default") {
    return "Workspace default";
  }

  return "Global fallback";
};

const getSourceBadgeVariant = (source) => {
  if (source === "manual") {
    return "default";
  }

  if (source === "workspace-default") {
    return "secondary";
  }

  return "outline";
};

const getFallbackLabel = ({ source, workspaceDefaultSender }) => {
  if (source === "manual" && workspaceDefaultSender) {
    return `${workspaceDefaultSender.name} (${workspaceDefaultSender.role})`;
  }

  return "System default";
};

const WorkspaceMailSenderCard = ({
  currentUser,
  currentWorkspaceSender,
  eligibleSenders = [],
  errorMessage,
  isLoading,
  isSaving,
  isTesting,
  canSendTestMail,
  onSendTestMail,
  onActivateSelected,
  onClearSender,
  onSelectedSenderChange,
  selectedSenderId,
}) => {
  const [showSenderPicker, setShowSenderPicker] = useState(false);

  const senderOptions = eligibleSenders.map((user) => ({
    value: user._id,
    label: user.name,
    email: user.email,
    role: user.role,
    smtpConfigured: Boolean(user.smtpConfigured),
  }));
  const selectedSender =
    senderOptions.find(
      (option) => String(option.value) === String(selectedSenderId)
    ) || null;
  const source = currentWorkspaceSender?.source || "global-default";
  const activeSenderUser =
    currentWorkspaceSender?.enabled && currentWorkspaceSender?.user
      ? currentWorkspaceSender.user
      : null;
  const manualSenderUser =
    currentWorkspaceSender?.manualSelection?.enabled &&
    currentWorkspaceSender?.manualSelection?.user
      ? currentWorkspaceSender.manualSelection.user
      : null;
  const workspaceDefaultSender =
    currentWorkspaceSender?.workspaceDefault?.enabled &&
    currentWorkspaceSender?.workspaceDefault?.user
      ? currentWorkspaceSender.workspaceDefault.user
      : null;
  const isUsingGlobalFallback = !activeSenderUser && source === "global-default";
  const activeSenderTitle = activeSenderUser
    ? `${activeSenderUser.name} (${activeSenderUser.role})`
    : "Using global fallback sender";
  const activeSenderEmail = activeSenderUser?.email || "No sender configured for your account.";
  const activeSenderStatus = getSourceStatusLabel(source);
  const currentUserProfile =
    eligibleSenders.find((user) => String(user._id) === String(currentUser?._id || "")) ||
    null;
  const currentUserNeedsSmtpSetup = Boolean(
    currentUserProfile && !currentUserProfile.smtpConfigured
  );

  return (
    <Card className="shadow-[0_24px_64px_-42px_rgba(15,23,42,0.32)]">
      <CardHeader className="space-y-3 border-b border-slate-100">
        <div>
          <CardTitle>Workspace Mail Sender</CardTitle>
          <CardDescription>
            Save an active sender for your account. Your manual choice stays in place
            across logins until you reset it to the workspace default.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {errorMessage ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[192px] w-full rounded-[24px]" />
            <Skeleton className="h-[158px] w-full rounded-[24px]" />
          </div>
        ) : (
          <>
            <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-500">
                    <MailCheck className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                      Active sender
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-slate-950">{activeSenderTitle}</p>
                    <p className="mt-1 text-sm text-slate-600">{activeSenderEmail}</p>
                  </div>
                </div>

                {!isUsingGlobalFallback ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={activeSenderUser?.smtpConfigured ? "success" : "secondary"}>
                      {activeSenderUser?.smtpConfigured
                        ? "SMTP Configured"
                        : "Using global fallback"}
                    </Badge>
                    <Badge variant={getSourceBadgeVariant(source)}>
                      {getSourceBadgeLabel(source)}
                    </Badge>
                    {activeSenderUser ? (
                      <Badge variant="default">Active sender</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {!isUsingGlobalFallback ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="sm:min-w-[170px]"
                    onClick={onSendTestMail}
                    disabled={!canSendTestMail || isTesting}
                  >
                    {isTesting ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Send Test Mail
                      </>
                    )}
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant={isUsingGlobalFallback ? "default" : "outline"}
                  className="sm:min-w-[170px]"
                  onClick={() => setShowSenderPicker((current) => !current)}
                  disabled={!eligibleSenders.length}
                >
                  <Settings2 className="h-4 w-4" />
                  {isUsingGlobalFallback ? "Set Active Sender" : "Change Sender"}
                </Button>

                {manualSenderUser ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="sm:min-w-[210px]"
                    onClick={onClearSender}
                    disabled={isSaving}
                  >
                    Reset to Workspace Default
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-6">
              <div>
                <p className="text-sm font-semibold text-slate-950">Sender Details</p>
                <p className="mt-1 text-sm text-slate-500">
                  Issue notifications use your saved sender first, then the workspace
                  default sender, and finally the global fallback sender.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <SummaryRow
                  label="Role"
                  value={activeSenderUser?.role || "Global fallback"}
                />
                <SummaryRow label="Status" value={activeSenderStatus} />
                <SummaryRow
                  label="Fallback"
                  value={getFallbackLabel({ source, workspaceDefaultSender })}
                />
              </div>

              {workspaceDefaultSender ? (
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                  Workspace default sender:{" "}
                  <span className="font-medium text-slate-900">
                    {workspaceDefaultSender.name}
                  </span>{" "}
                  <span className="text-slate-500">({workspaceDefaultSender.email})</span>
                </div>
              ) : null}
            </div>

            {currentWorkspaceSender?.note ? (
              <div className="flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{currentWorkspaceSender.note}</span>
              </div>
            ) : null}

            {currentUserNeedsSmtpSetup ? (
              <div className="flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Save SMTP settings for this account to use it as active sender.
                </span>
              </div>
            ) : null}

            {showSenderPicker ? (
              eligibleSenders.length ? (
                <div className="space-y-4 rounded-[26px] border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Change sender</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Pick an Admin or Manager for your account. This selection stays
                      saved until you reset it to the workspace default.
                    </p>
                  </div>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Select sender user
                    </span>
                    <Select
                      inputId="workspace-mail-sender"
                      isClearable
                      isDisabled={isSaving}
                      options={senderOptions}
                      value={selectedSender}
                      styles={senderSelectStyles}
                      formatOptionLabel={formatSenderOptionLabel}
                      onChange={(option) => onSelectedSenderChange(option?.value || "")}
                      placeholder="Search Admin or Manager by name or email"
                      noOptionsMessage={() => "No eligible sender users found."}
                    />
                  </label>

                  {selectedSender ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <SummaryRow label="Selected sender" value={selectedSender.label} />
                      <SummaryRow label="Email" value={selectedSender.email} />
                      <SummaryRow label="Role" value={selectedSender.role} />
                      <SummaryRow
                        label="SMTP Configured"
                        value={selectedSender.smtpConfigured ? "Yes" : "No"}
                      />
                    </div>
                  ) : null}

                  {selectedSender && !selectedSender.smtpConfigured ? (
                    <div className="flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Save SMTP settings for {selectedSender.label} before assigning
                        them as your active sender.
                      </span>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      className="sm:min-w-[190px]"
                      onClick={onActivateSelected}
                      disabled={
                        isSaving ||
                        !selectedSender ||
                        !selectedSender.smtpConfigured
                      }
                    >
                      {isSaving ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <MailCheck className="h-4 w-4" />
                          Save Active Sender
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="sm:min-w-[150px]"
                      onClick={() => setShowSenderPicker(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-800">
                  Promote a workspace user to Admin or Manager to make them eligible as a
                  sender.
                </div>
              )
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkspaceMailSenderCard;
