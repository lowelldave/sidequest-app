import { SettingsNav } from "@/components/settings/SettingsNav";

// No <Gate> here: a layout must always render its pages (see Gate.tsx). Each
// settings page has its own.
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Your account, and for the admin, the shop&apos;s people and setup.</p>
      </header>
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
