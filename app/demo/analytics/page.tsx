import { AnalyticsDashboard } from "@/app/admin/analytics/analytics-dashboard";

/**
 * Public, no-login copy of /admin/analytics — same real queries, same
 * aggregate-only numbers (no user names/emails are ever fetched here), for
 * sharing a direct link with mentors/reviewers who shouldn't need an admin
 * account just to see the metrics stack.
 */
export default function PublicAnalyticsPage() {
  return <AnalyticsDashboard eyebrow="Vantage" />;
}
