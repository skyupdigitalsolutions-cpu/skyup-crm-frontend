import { Globe } from "lucide-react";
import SourcePerformanceReport from "./SourcePerformanceReport";

// Website Performance — leads captured via the website contact-form webhook,
// grouped per configured source. No ad spend, so this is lead/conversion analytics.
export default function WebsiteInsightsReport() {
  return (
    <SourcePerformanceReport
      endpoint="/website-config/insights"
      title="Website Performance"
      subtitle="Leads and conversions per website form / source"
      icon={Globe}
      theme="emerald"
      withCost={false}
    />
  );
}
