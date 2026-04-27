import SettingsSidebar from "@/components/settings/SettingsSidebar";

const AdminSettingsLayout = ({
  activeItem,
  children,
  items,
  onActiveItemChange,
}) => (
  <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
    <SettingsSidebar
      activeItem={activeItem}
      items={items}
      onItemChange={onActiveItemChange}
    />
    <main className="min-w-0">{children}</main>
  </div>
);

export default AdminSettingsLayout;
