import SettingsPanel from "@/components/settings/SettingsPanel";
import EmailConfigurationCard from "@/components/settings/EmailConfigurationCard";

const SMTPConfigurationSettings = (props) => (
  <SettingsPanel
    title="SMTP Configuration"
    description="View and edit SMTP credentials for the currently selected Admin or Manager sender."
  >
    <EmailConfigurationCard {...props} embedded defaultExpanded />
  </SettingsPanel>
);

export default SMTPConfigurationSettings;
