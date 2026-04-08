
export default function ScheduledCallsBadge({ scheduledCalls = [] }) {
  const pending = scheduledCalls.filter(c => !c.done);
  if (!pending.length) return null;

  const typeColor = {
    follow_up:    "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    verification: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
  };

  const typeLabel = {
    follow_up:    "Follow-up",
    verification: "Verification",
  };

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {pending.map((c, i) => {
        const date = new Date(c.scheduledAt);
        const isOverdue = date < new Date();
        return (
          <span
            key={i}
            title={c.note || ""}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isOverdue ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" : typeColor[c.type]}`}
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {typeLabel[c.type] || c.type} · {date.toLocaleDateString()}
            {isOverdue && " ⚠️"}
          </span>
        );
      })}
    </div>
  );
}