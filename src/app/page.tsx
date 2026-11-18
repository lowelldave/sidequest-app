import { Dashboard } from "@/components/Dashboard";
import { Gate } from "@/components/Gate";

export default function Home() {
  return (
    <Gate permission="dashboard.view">
      <Dashboard />
    </Gate>
  );
}
