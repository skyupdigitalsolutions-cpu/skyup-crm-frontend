// Same values as the mobile app's LeadDetailScreen / LeadsScreen.
export const OUTCOMES_NOT_ANSWERED = ['Not Answered', 'Busy', 'Switch Off'];
export const OUTCOMES_ANSWERED = ['Interested', 'Not Interested', 'Call Back Later', 'Client Meeting', 'Proposal Sent'];
export const STATUS_OPTIONS = ['New', 'In Progress', 'Interested', 'Converted', 'Not Interested'];
export const TEMPERATURES = ['Hot', 'Warm', 'Cold'];

const STATUS_PRIORITY = { New: 0, 'In Progress': 1, Interested: 2, Converted: 3, 'Not Interested': 4 };

// Outcome → status upgrade (never downgrades), same rule as the app.
export function autoStatusForOutcome(outcome, current = 'New') {
  let suggested = null;
  if (outcome === 'Interested' || outcome === 'Client Meeting' || outcome === 'Proposal Sent') suggested = 'Interested';
  else if (OUTCOMES_ANSWERED.includes(outcome) || outcome === 'Answered') suggested = 'In Progress';
  if (!suggested) return null;
  return (STATUS_PRIORITY[suggested] ?? 0) > (STATUS_PRIORITY[current] ?? 0) ? suggested : null;
}

export const STATUS_TONE = {
  New: 'blue', 'In Progress': 'amber', Interested: 'green', Converted: 'purple', 'Not Interested': 'muted',
};
export const TEMP_TONE = { Hot: 'red', Warm: 'amber', Cold: 'blue' };
