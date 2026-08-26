import { requireAdmin } from "@/lib/auth/admin";
import { AnalyticsDashboard } from "./analytics-dashboard";

export default async function AnalyticsPage() {
  await requireAdmin();
  return <AnalyticsDashboard />;
}
