import { MousePointerClick } from "lucide-react";
import SourcePerformanceReport from "./SourcePerformanceReport";

// Google Ads Performance — leads captured via the Google Ads webhook, grouped
// per campaign, with cost-per-lead where a spend is entered on the campaign.
export default function GoogleAdsInsightsReport() {
  return (
    <SourcePerformanceReport
      endpoint="/google-ads-config/insights"
      title="Google Ads Performance"
      subtitle="Leads, conversions and cost-per-lead per Google Ads campaign"
      icon={MousePointerClick}
      theme="blue"
      withCost={true}
    />
  );
}
