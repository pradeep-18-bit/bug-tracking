import Select from "react-select";
import { ShieldCheck } from "lucide-react";
import {
  formatMemberOptionLabel,
  memberSelectStyles,
} from "@/components/projects/memberSelectTheme";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WORKSPACE_ROLE_OPTIONS } from "@/lib/roles";

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

const ModifyRoleSettings = ({
  currentRole,
  isLoading,
  isRoleUpdateDisabled,
  newRole,
  onNewRoleChange,
  onRoleSelectionChange,
  onSubmit,
  roleUpdateMutation,
  selectedUser,
  selectedUserOption,
  userOptions = [],
  users = [],
}) => (
  <SettingsPanel
    title="Modify User Role"
    description="Update roles of existing workspace users while keeping role changes auditable."
  >
    <div className="max-w-2xl space-y-5">
      <form className="space-y-4" onSubmit={onSubmit}>
        {!users.length && !isLoading ? (
          <div className="rounded-[16px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
            Invite or import users before modifying workspace roles.
          </div>
        ) : null}

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
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
            onChange={onRoleSelectionChange}
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
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Current Role
          </span>
          <Input value={currentRole} placeholder="Select a user first" disabled />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            New Role
          </span>
          <select
            className="field-select"
            value={newRole}
            onChange={(event) => onNewRoleChange(event.target.value)}
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

        <Button type="submit" disabled={isRoleUpdateDisabled}>
          <ShieldCheck className="h-4 w-4" />
          {roleUpdateMutation.isPending ? "Updating..." : "Update Role"}
        </Button>
      </form>
    </div>
  </SettingsPanel>
);

export default ModifyRoleSettings;
