// src/data/customizationDefaults.js — GENERATED from the backend's
// config/customizationDefaults.js. Used only until the company's real
// customization arrives from GET /api/customization (and as an offline
// fallback). Keep in sync by regenerating if the backend defaults change.
/* eslint-disable */
export const CUSTOMIZATION_DEFAULTS = {
  "modules": {
    "dashboard": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "leadManagement": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "contacts": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "campaigns": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "callMonitoring": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "pipelineBoard": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "clientMeetings": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "projects": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "tasks": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "basicReports": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "dailyReport": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "customReports": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "leadIntelligence": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "callOutcomesReport": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "attendance": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "payroll": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "communications": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "whatsappBlast": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "smsBlast": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "emailBlast": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "whatsappAutomation": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "festivalCampaigns": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "leadNurtureSequence": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": false
    },
    "telegramNotification": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "whatsappScreenshots": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "callRecording": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "callTranscription": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "aiSummary": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "voiceBot": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "metaAds": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "googleAds": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "linkedInAds": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "websiteTracking": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "googleSheetIntegration": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "metaConversionSync": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "apiAccess": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "webhookAccess": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "customBranding": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "whiteLabel": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    },
    "customDomain": {
      "enabled": true,
      "label": "",
      "admin": true,
      "employee": true
    }
  },
  "statuses": [
    {
      "key": "New",
      "label": "New",
      "color": "blue",
      "category": "new",
      "order": 1,
      "active": true,
      "isDefault": true,
      "employeeSelectable": true,
      "showInPipeline": true,
      "metaEvent": "Lead",
      "aliases": [],
      "system": true
    },
    {
      "key": "In Progress",
      "label": "In Progress",
      "color": "amber",
      "category": "open",
      "order": 2,
      "active": true,
      "isDefault": false,
      "employeeSelectable": true,
      "showInPipeline": true,
      "metaEvent": "Contact",
      "aliases": [],
      "system": true
    },
    {
      "key": "Interested",
      "label": "Interested",
      "color": "emerald",
      "category": "interested",
      "order": 3,
      "active": true,
      "isDefault": false,
      "employeeSelectable": false,
      "showInPipeline": false,
      "metaEvent": "Schedule",
      "aliases": [
        "Interest"
      ],
      "system": true
    },
    {
      "key": "Verification",
      "label": "Verification",
      "color": "purple",
      "category": "verification",
      "order": 4,
      "active": true,
      "isDefault": false,
      "employeeSelectable": false,
      "showInPipeline": true,
      "metaEvent": "",
      "aliases": [],
      "system": true
    },
    {
      "key": "Converted",
      "label": "Converted",
      "color": "emerald",
      "category": "won",
      "order": 5,
      "active": true,
      "isDefault": false,
      "employeeSelectable": true,
      "showInPipeline": true,
      "metaEvent": "Purchase",
      "aliases": [
        "Won"
      ],
      "system": true
    },
    {
      "key": "Not Interested",
      "label": "Not Interested",
      "color": "red",
      "category": "lost",
      "order": 6,
      "active": true,
      "isDefault": false,
      "employeeSelectable": true,
      "showInPipeline": false,
      "metaEvent": "",
      "aliases": [],
      "system": true
    }
  ],
  "outcomes": [
    {
      "key": "Answered",
      "label": "Answered",
      "color": "emerald",
      "group": "answered",
      "order": 1,
      "active": true,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "In Progress",
      "automationKey": "answered",
      "allowForManualLeads": true,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Not Answered",
      "label": "Not Answered",
      "color": "slate",
      "group": "notAnswered",
      "order": 2,
      "active": true,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "notAnswered",
      "allowForManualLeads": false,
      "countsAsConnected": false,
      "automation": null
    },
    {
      "key": "Busy",
      "label": "Busy",
      "color": "amber",
      "group": "notAnswered",
      "order": 3,
      "active": true,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "busy",
      "allowForManualLeads": false,
      "countsAsConnected": false,
      "automation": null
    },
    {
      "key": "Switch Off",
      "label": "Switch Off",
      "color": "gray",
      "group": "notAnswered",
      "order": 4,
      "active": true,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "switchOff",
      "allowForManualLeads": false,
      "countsAsConnected": false,
      "automation": null
    },
    {
      "key": "Call Back Later",
      "label": "Call Back Later",
      "color": "sky",
      "group": "answered",
      "order": 5,
      "active": true,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "In Progress",
      "automationKey": "callBackLater",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Interested",
      "label": "Interested",
      "color": "emerald",
      "group": "answered",
      "order": 6,
      "active": true,
      "system": true,
      "behavior": "interested",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "Interested",
      "automationKey": "",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Not Interested",
      "label": "Not Interested",
      "color": "red",
      "group": "answered",
      "order": 7,
      "active": true,
      "system": true,
      "behavior": "notInterested",
      "followUp": "none",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "notInterested",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Invalid",
      "label": "Invalid",
      "color": "rose",
      "group": "other",
      "order": 8,
      "active": true,
      "system": true,
      "behavior": "invalid",
      "followUp": "none",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "",
      "allowForManualLeads": false,
      "countsAsConnected": false,
      "automation": null
    },
    {
      "key": "Client Meeting",
      "label": "Client Meeting",
      "color": "purple",
      "group": "answered",
      "order": 9,
      "active": true,
      "system": true,
      "behavior": "clientMeeting",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "Interested",
      "automationKey": "",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Proposal Sent",
      "label": "Proposal Sent",
      "color": "indigo",
      "group": "answered",
      "order": 10,
      "active": true,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "Interested",
      "automationKey": "",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Call Back",
      "label": "Call Back",
      "color": "sky",
      "group": "answered",
      "order": 11,
      "active": false,
      "system": true,
      "behavior": "none",
      "followUp": "auto",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "callBack",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Not Reachable",
      "label": "Not Reachable",
      "color": "gray",
      "group": "notAnswered",
      "order": 12,
      "active": false,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "notReachable",
      "allowForManualLeads": false,
      "countsAsConnected": false,
      "automation": null
    },
    {
      "key": "Meeting Scheduled",
      "label": "Meeting Scheduled",
      "color": "purple",
      "group": "answered",
      "order": 13,
      "active": false,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "meetingScheduled",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Demo Done",
      "label": "Demo Done",
      "color": "teal",
      "group": "answered",
      "order": 14,
      "active": false,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "",
      "automationKey": "demoDone",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    },
    {
      "key": "Converted",
      "label": "Converted",
      "color": "emerald",
      "group": "answered",
      "order": 15,
      "active": false,
      "system": true,
      "behavior": "none",
      "followUp": "optional",
      "autoFollowUpDays": 1,
      "autoStatus": "Converted",
      "automationKey": "converted",
      "allowForManualLeads": false,
      "countsAsConnected": true,
      "automation": null
    }
  ],
  "temperatures": [
    {
      "key": "Hot",
      "label": "Hot",
      "color": "red",
      "order": 1,
      "active": true,
      "system": true,
      "triggersColdFlow": false
    },
    {
      "key": "Warm",
      "label": "Warm",
      "color": "amber",
      "order": 2,
      "active": true,
      "system": true,
      "triggersColdFlow": false
    },
    {
      "key": "Cold",
      "label": "Cold",
      "color": "blue",
      "order": 3,
      "active": true,
      "system": true,
      "triggersColdFlow": true
    }
  ],
  "lists": {
    "sources": [
      "Manual",
      "Google Ads",
      "Campaign",
      "Facebook Ads",
      "Web Form",
      "Referral",
      "CSV Import",
      "Channel Partner",
      "Other"
    ],
    "meetingTypes": [
      "In-Person",
      "Video Call",
      "Phone Call",
      "Site Visit",
      "Demo"
    ],
    "meetingOutcomes": [
      "Interested",
      "Not Interested",
      "Converted",
      "Follow-Up Required",
      "Pending Decision",
      "No Show"
    ],
    "closeReasons": [
      "Wrong entry",
      "Duplicate",
      "Fake lead",
      "Wrong number",
      "Test lead"
    ],
    "notInterestedReasons": [
      "Price too high",
      "Not the decision maker",
      "Already using a competitor",
      "No requirement now",
      "Budget issue",
      "Other"
    ],
    "industries": [
      "Healthcare",
      "Education",
      "Real Estate",
      "Logistics",
      "Finance",
      "IT Solutions",
      "Digital Marketing",
      "Construction",
      "Local Business",
      "Interior Designers",
      "Professional Services"
    ],
    "services": [
      "SEO",
      "Paid Ads",
      "Website Design & Development",
      "AI Automation",
      "CRM",
      "Video Editing",
      "Graphic Design",
      "Social Media Marketing",
      "AI Voice Agent"
    ],
    "languages": [
      "English",
      "Hindi",
      "Kannada",
      "Tamil",
      "Telugu",
      "Malayalam",
      "Marathi",
      "Bengali",
      "Gujarati"
    ]
  },
  "leadFields": {
    "email": {
      "visible": true,
      "required": false,
      "label": "Email"
    },
    "secondaryPhone": {
      "visible": true,
      "required": false,
      "label": "Additional Number"
    },
    "source": {
      "visible": true,
      "required": false,
      "label": "Source"
    },
    "campaign": {
      "visible": true,
      "required": false,
      "label": "Campaign"
    },
    "temperature": {
      "visible": true,
      "required": false,
      "label": "Lead Quality"
    },
    "industry": {
      "visible": true,
      "required": false,
      "label": "Industry"
    },
    "service": {
      "visible": true,
      "required": false,
      "label": "Service"
    },
    "businessName": {
      "visible": true,
      "required": false,
      "label": "Business Name"
    },
    "language": {
      "visible": true,
      "required": false,
      "label": "Language"
    },
    "remark": {
      "visible": true,
      "required": true,
      "label": "Remark"
    }
  },
  "customFields": [],
  "workflows": {
    "leadUpdate": {
      "remarkRequired": true,
      "preventPastFollowUp": true,
      "defaultFollowUpDays": 1,
      "defaultFollowUpHour": 9,
      "defaultOutcomeWhenMissing": "Call Back",
      "hideInterestedOnceInterested": true,
      "autoAdvanceStatusFromOutcome": true,
      "completeOldestPendingOnUpdate": true
    },
    "leadCreation": {
      "defaultSource": "Web Form",
      "defaultImportSource": "Excel Import",
      "defaultRemark": "Manually added",
      "defaultImportRemark": "Imported via Excel",
      "autoTemperature": true
    },
    "assignment": {
      "strategy": "least_loaded",
      "importStrategy": "round_robin"
    },
    "notInterested": {
      "enabled": true,
      "verification": true,
      "verificationStatus": "Verification",
      "finalStatus": "Not Interested",
      "resetStatus": "New",
      "followUps": [
        {
          "type": "follow-up",
          "days": 3,
          "note": "Auto follow-up after Not Interested"
        },
        {
          "type": "verification",
          "days": 7,
          "note": "7-day verification call"
        },
        {
          "type": "verification",
          "days": 30,
          "note": "1-month verification call"
        }
      ]
    },
    "cold": {
      "enabled": true,
      "verification": true,
      "verificationStatus": "Verification",
      "returnStatus": "New",
      "followUps": [
        {
          "type": "follow-up",
          "days": 3,
          "note": "Auto follow-up after Cold reassignment"
        },
        {
          "type": "verification",
          "days": 7,
          "note": "7-day verification call"
        },
        {
          "type": "verification",
          "days": 30,
          "note": "1-month verification call"
        }
      ]
    },
    "invalid": {
      "enabled": true,
      "verification": true,
      "verificationStatus": "Verification",
      "closedStatus": "Not Interested",
      "resetStatus": "New"
    },
    "closeByEmployee": {
      "enabled": true,
      "closedStatus": "Not Interested",
      "requirePhone": true
    }
  },
  "permissions": {
    "employee": {
      "canAddLeads": true,
      "canImportLeads": true,
      "canEditLeadDetails": true,
      "canEditPhoneNumbers": true,
      "canDeleteLeads": true,
      "canCloseLeads": true,
      "canMarkInvalid": true,
      "canMarkNotInterested": true,
      "canMarkCold": true,
      "canMergeLeads": true,
      "canRevealContact": true,
      "canChangeTemperature": true,
      "canScheduleFollowUps": true,
      "canExportLeads": true,
      "canLogClientMeetings": true
    },
    "admin": {
      "canDeleteLeads": true,
      "canImportLeads": true,
      "canExportLeads": true,
      "canReassignLeads": true
    }
  },
  "alerts": {
    "noAction": {
      "enabled": true,
      "firstAlertHours": 1,
      "secondAlertHours": 2,
      "escalationHours": 3,
      "escalationEnabled": true
    },
    "noFollowUpDate": {
      "enabled": true,
      "afterHours": 24,
      "repeatEveryHours": 24
    },
    "followUpDigest": {
      "enabled": true,
      "time": "09:30"
    },
    "callReminder": {
      "enabled": true,
      "minutesBefore": 15
    },
    "leadFollowUpReminder": {
      "enabled": true,
      "intervalDays": 3,
      "morningTime": "09:30",
      "eveningTime": "20:30",
      "eveningEnabled": true
    }
  },
  "general": {
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "dateFormat": "DD MMM YYYY",
    "defaultCountryCode": "91",
    "appName": "",
    "terminology": {
      "lead": "Lead",
      "leads": "Leads",
      "employee": "Employee",
      "employees": "Employees",
      "admin": "Admin",
      "campaign": "Campaign",
      "followUp": "Follow-up"
    }
  },
  "messaging": {
    "smsGreeting": "Hi {{name}}, thank you for contacting {{company}}! Our team will connect with you shortly.",
    "dailyReportTitle": "{{company}} — DAILY SALES REPORT"
  },
  "dashboard": {
    "widgets": {
      "kpis": true,
      "pipeline": true,
      "sources": true,
      "temperature": true,
      "followUps": true,
      "employeePerformance": true,
      "recentLeads": true,
      "campaigns": true
    }
  }
};

export const CUSTOMIZATION_META = {
  "modules": [
    {
      "key": "dashboard",
      "group": "Core",
      "label": "Dashboard",
      "navOnly": true
    },
    {
      "key": "leadManagement",
      "group": "Core",
      "label": "Leads"
    },
    {
      "key": "contacts",
      "group": "Core",
      "label": "Contacts"
    },
    {
      "key": "campaigns",
      "group": "Core",
      "label": "Campaigns",
      "navOnly": true
    },
    {
      "key": "callMonitoring",
      "group": "Core",
      "label": "Call Monitoring",
      "navOnly": true
    },
    {
      "key": "pipelineBoard",
      "group": "Core",
      "label": "Pipeline Board",
      "navOnly": true
    },
    {
      "key": "clientMeetings",
      "group": "Core",
      "label": "Client Meetings",
      "navOnly": true
    },
    {
      "key": "projects",
      "group": "Core",
      "label": "Projects"
    },
    {
      "key": "tasks",
      "group": "Core",
      "label": "Tasks"
    },
    {
      "key": "basicReports",
      "group": "Reports",
      "label": "Report Page"
    },
    {
      "key": "dailyReport",
      "group": "Reports",
      "label": "Daily Report"
    },
    {
      "key": "customReports",
      "group": "Reports",
      "label": "Custom Reports"
    },
    {
      "key": "leadIntelligence",
      "group": "Reports",
      "label": "Lead Intelligence"
    },
    {
      "key": "callOutcomesReport",
      "group": "Reports",
      "label": "Call Outcomes Report"
    },
    {
      "key": "attendance",
      "group": "People",
      "label": "Attendance"
    },
    {
      "key": "payroll",
      "group": "People",
      "label": "Payroll"
    },
    {
      "key": "communications",
      "group": "Communication",
      "label": "Communications",
      "navOnly": true
    },
    {
      "key": "whatsappBlast",
      "group": "Communication",
      "label": "WhatsApp Blast"
    },
    {
      "key": "smsBlast",
      "group": "Communication",
      "label": "SMS Blast"
    },
    {
      "key": "emailBlast",
      "group": "Communication",
      "label": "Email Blast"
    },
    {
      "key": "whatsappAutomation",
      "group": "Communication",
      "label": "WhatsApp Automation"
    },
    {
      "key": "festivalCampaigns",
      "group": "Communication",
      "label": "Festival Campaigns",
      "navOnly": true
    },
    {
      "key": "leadNurtureSequence",
      "group": "Communication",
      "label": "Lead Nurture"
    },
    {
      "key": "telegramNotification",
      "group": "Communication",
      "label": "Telegram Notifications"
    },
    {
      "key": "whatsappScreenshots",
      "group": "Communication",
      "label": "WhatsApp Screenshot Proof",
      "navOnly": true
    },
    {
      "key": "callRecording",
      "group": "Calling & AI",
      "label": "Call Recording"
    },
    {
      "key": "callTranscription",
      "group": "Calling & AI",
      "label": "Call Transcription"
    },
    {
      "key": "aiSummary",
      "group": "Calling & AI",
      "label": "AI Summary"
    },
    {
      "key": "voiceBot",
      "group": "Calling & AI",
      "label": "Voice Bot"
    },
    {
      "key": "metaAds",
      "group": "Integrations",
      "label": "Meta Ads"
    },
    {
      "key": "googleAds",
      "group": "Integrations",
      "label": "Google Ads"
    },
    {
      "key": "linkedInAds",
      "group": "Integrations",
      "label": "LinkedIn Ads"
    },
    {
      "key": "websiteTracking",
      "group": "Integrations",
      "label": "Website Forms"
    },
    {
      "key": "googleSheetIntegration",
      "group": "Integrations",
      "label": "Excel / Google Sheet"
    },
    {
      "key": "metaConversionSync",
      "group": "Integrations",
      "label": "Meta Conversion Sync"
    },
    {
      "key": "apiAccess",
      "group": "Integrations",
      "label": "API Access"
    },
    {
      "key": "webhookAccess",
      "group": "Integrations",
      "label": "Webhooks"
    },
    {
      "key": "customBranding",
      "group": "Branding",
      "label": "Custom Branding"
    },
    {
      "key": "whiteLabel",
      "group": "Branding",
      "label": "White Label"
    },
    {
      "key": "customDomain",
      "group": "Branding",
      "label": "Custom Domain"
    }
  ],
  "palette": {
    "blue": "#2563EB",
    "sky": "#0284C7",
    "cyan": "#0891B2",
    "teal": "#0D9488",
    "emerald": "#059669",
    "green": "#16A34A",
    "lime": "#65A30D",
    "yellow": "#CA8A04",
    "amber": "#D97706",
    "orange": "#EA580C",
    "red": "#DC2626",
    "rose": "#E11D48",
    "pink": "#DB2777",
    "purple": "#7C3AED",
    "violet": "#8B5CF6",
    "indigo": "#4F46E5",
    "slate": "#475569",
    "gray": "#6B7280"
  },
  "statusCategories": [
    "new",
    "open",
    "interested",
    "verification",
    "won",
    "lost"
  ],
  "outcomeBehaviours": [
    "none",
    "interested",
    "notInterested",
    "invalid",
    "cold",
    "clientMeeting"
  ],
  "followUpRules": [
    "none",
    "optional",
    "required",
    "auto"
  ],
  "outcomeGroups": [
    "answered",
    "notAnswered",
    "other"
  ],
  "customFieldTypes": [
    "text",
    "textarea",
    "number",
    "date",
    "datetime",
    "select",
    "multiselect",
    "checkbox",
    "email",
    "phone",
    "url"
  ],
  "sections": [
    "modules",
    "statuses",
    "outcomes",
    "temperatures",
    "lists",
    "leadFields",
    "customFields",
    "workflows",
    "permissions",
    "alerts",
    "general",
    "messaging",
    "dashboard"
  ]
};
