import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MailPlus,
  ShieldCheck,
  UserCircle2,
  Users2,
} from "lucide-react";
import {
  bulkInviteUsers,
  fetchManagedUsers,
  inviteUser,
} from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";
import ImportUsers from "@/components/settings/ImportUsers";
import EmptyState from "@/components/shared/EmptyState";
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
import { Textarea } from "@/components/ui/textarea";

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

const ResultList = ({ title, items = [], tone = "rose" }) => {
  if (!items.length) {
    return null;
  }

  const toneClassName =
    tone === "amber"
      ? "border-amber-200 bg-amber-50/80 text-amber-800"
      : "border-rose-200 bg-rose-50/80 text-rose-800";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClassName}`}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={typeof item === "string" ? item : item.email}
            className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs"
          >
            {typeof item === "string" ? item : `${item.email} - ${item.reason}`}
          </span>
        ))}
      </div>
    </div>
  );
};

const UserSettingsPage = () => {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Developer");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState("Developer");
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [recentInvite, setRecentInvite] = useState(null);
  const [bulkResult, setBulkResult] = useState({
    created: [],
    skipped: [],
    invalid: [],
  });

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["managed-users"],
    queryFn: fetchManagedUsers,
  });

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

  const bulkInviteMutation = useMutation({
    mutationFn: bulkInviteUsers,
    onSuccess: (data) => {
      setBulkFeedback(data.message || "Bulk import finished");
      setBulkResult({
        created: data.created || [],
        skipped: data.skipped || [],
        invalid: data.invalid || [],
      });
      setBulkEmails("");
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
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

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    setInviteFeedback("");
    setRecentInvite(null);

    try {
      await inviteMutation.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
    } catch (error) {
      return error;
    }
  };

  const handleBulkSubmit = async (event) => {
    event.preventDefault();
    setBulkFeedback("");
    setBulkResult({
      created: [],
      skipped: [],
      invalid: [],
    });

    try {
      await bulkInviteMutation.mutateAsync({
        emails: bulkEmails,
        role: bulkRole,
      });
    } catch (error) {
      return error;
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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
            <CardTitle>Bulk invite</CardTitle>
            <CardDescription>
              Import multiple users at once using comma-separated, line-separated, or semicolon-separated emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleBulkSubmit}>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  Emails
                </span>
                <Textarea
                  placeholder="alex@company.com, sam@company.com, riley@company.com"
                  value={bulkEmails}
                  onChange={(event) => setBulkEmails(event.target.value)}
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">Role</span>
                <select
                  className="field-select"
                  value={bulkRole}
                  onChange={(event) => setBulkRole(event.target.value)}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                className="w-full"
                type="submit"
                disabled={bulkInviteMutation.isPending}
              >
                <MailPlus className="h-4 w-4" />
                {bulkInviteMutation.isPending ? "Importing..." : "Run bulk invite"}
              </Button>
            </form>

            {bulkInviteMutation.isError ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                {bulkInviteMutation.error?.response?.data?.message ||
                  "Unable to import users right now."}
              </div>
            ) : null}

            {bulkFeedback ? (
              <div className="rounded-[24px] border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-800">
                {bulkFeedback}
              </div>
            ) : null}

            <CredentialsPreview
              title="New accounts created"
              entries={bulkResult.created}
              helperText="These temporary passwords are only shown here once. Copy them somewhere secure for your onboarding flow."
            />

            <ResultList title="Skipped emails" items={bulkResult.skipped} tone="amber" />
            <ResultList title="Invalid emails" items={bulkResult.invalid} />
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
