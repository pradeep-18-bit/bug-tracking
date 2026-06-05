import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  fetchManagedUsers,
  fetchModuleOwnerships,
  fetchTeams,
  saveModuleOwnerships,
} from "@/lib/api";
import { BUG_MODULE_OPTIONS } from "@/lib/issues";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const createRow = (overrides = {}) => ({
  moduleName: "",
  teamId: "",
  developerId: "",
  responsibleTeamName: "",
  ...overrides,
});

const ModuleOwnershipSettings = ({ showToast }) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([createRow()]);

  const { data: ownerships = [], isLoading: isOwnershipsLoading } = useQuery({
    queryKey: ["module-ownerships"],
    queryFn: fetchModuleOwnerships,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams", "module-ownerships"],
    queryFn: fetchTeams,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["managed-users"],
    queryFn: fetchManagedUsers,
  });

  const developers = useMemo(
    () => users.filter((user) => user.role === "Developer"),
    [users]
  );

  useEffect(() => {
    if (!ownerships.length) {
      setRows([createRow()]);
      return;
    }

    setRows(
      ownerships.map((ownership) =>
        createRow({
          moduleName: ownership.moduleName || "",
          teamId: String(ownership.teamId || ""),
          developerId: String(ownership.developerId || ""),
          responsibleTeamName: ownership.responsibleTeamName || "",
        })
      )
    );
  }, [ownerships]);

  const saveMutation = useMutation({
    mutationFn: saveModuleOwnerships,
    onSuccess: (data) => {
      queryClient.setQueryData(["module-ownerships"], data?.ownerships || []);
      showToast?.("success", data?.message || "Module ownership mapping saved.");
    },
    onError: (error) => {
      showToast?.(
        "error",
        error.response?.data?.message || "Unable to save module ownerships."
      );
    },
  });

  const updateRow = (index, patch) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  };

  const removeRow = (index) => {
    setRows((current) =>
      current.length === 1 ? [createRow()] : current.filter((_, rowIndex) => rowIndex !== index)
    );
  };

  const handleSave = () => {
    saveMutation.mutate(
      rows
        .map((row) => ({
          moduleName: row.moduleName.trim(),
          teamId: row.teamId || null,
          developerId: row.developerId || null,
          responsibleTeamName: row.responsibleTeamName.trim(),
        }))
        .filter((row) => row.moduleName)
    );
  };

  return (
    <Card className="overflow-hidden border-white/70 bg-white/92 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.34)] backdrop-blur">
      <CardHeader className="border-b border-slate-200/80">
        <CardTitle>Module Ownership</CardTitle>
        <CardDescription>
          Map product areas to teams or developers for triage suggestions and tester bug creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-2 py-2">Module/Page</th>
                <th className="px-2 py-2">Responsible Team</th>
                <th className="px-2 py-2">Developer</th>
                <th className="px-2 py-2">Suggested Team Label</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={`${row.moduleName}-${index}`}>
                  <td className="px-2 py-2">
                    <Input
                      list="module-ownership-options"
                      value={row.moduleName}
                      onChange={(event) => updateRow(index, { moduleName: event.target.value })}
                      placeholder="Login Page"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="field-select"
                      value={row.teamId}
                      onChange={(event) => updateRow(index, { teamId: event.target.value })}
                    >
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team._id} value={team._id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="field-select"
                      value={row.developerId}
                      onChange={(event) => updateRow(index, { developerId: event.target.value })}
                    >
                      <option value="">No developer</option>
                      {developers.map((developer) => (
                        <option key={developer._id} value={developer._id}>
                          {developer.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.responsibleTeamName}
                      onChange={(event) =>
                        updateRow(index, { responsibleTeamName: event.target.value })
                      }
                      placeholder="Backend Team"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeRow(index)}
                      aria-label="Remove ownership row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="module-ownership-options">
            {BUG_MODULE_OPTIONS.map((moduleName) => (
              <option key={moduleName} value={moduleName} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((current) => [...current, createRow()])}
          >
            <Plus className="h-4 w-4" />
            Add Mapping
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveMutation.isPending || isOwnershipsLoading}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving" : "Save Mapping"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModuleOwnershipSettings;
