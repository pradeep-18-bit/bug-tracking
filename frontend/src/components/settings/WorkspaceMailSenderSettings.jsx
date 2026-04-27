import SettingsPanel from "@/components/settings/SettingsPanel";
import WorkspaceMailSenderCard from "@/components/settings/WorkspaceMailSenderCard";

const WorkspaceMailSenderSettings = (props) => (
  <SettingsPanel
    title="Workspace Mail Sender"
    headerClassName="px-4 py-4 sm:px-5"
    contentClassName="p-4 sm:p-5"
  >
    <WorkspaceMailSenderCard {...props} embedded />
  </SettingsPanel>
);

export default WorkspaceMailSenderSettings;
