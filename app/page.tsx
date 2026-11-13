import Dashboard from "@/components/Dashboard";
import { getTables } from "@/lib/db";

export default function Page() {
  return <Dashboard tables={getTables()} />;
}
