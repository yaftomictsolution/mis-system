import ModuleReportPage from "@/components/reports/ModuleReportPage";
import { isReportKey } from "@/modules/reports/reports.types";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ReportDetailPage({ params }: Props) {
  const { slug } = await params;
  const key = isReportKey(slug) ? slug : "sales";
  return <ModuleReportPage reportKey={key} />;
}
