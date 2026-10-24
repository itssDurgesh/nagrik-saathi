// Client-safe tool catalogue for the agent control panel.
export const TOOL_INFO: { name: string; label: string; description: string }[] = [
  { name: "analyze_photo", label: "Analyse photo", description: "Gemini vision reads the photo: issue type, severity, civic or not." },
  { name: "locate_ward", label: "Locate ward", description: "Maps GPS / pin / area name to an AMC ward and ward office." },
  { name: "route_department", label: "Route department", description: "Chooses the department and SLA (urgent = 24h)." },
  { name: "check_duplicates", label: "Check duplicates", description: "Looks for open complaints of the same kind within 250 m." },
  { name: "upvote_complaint", label: "+1 existing", description: "Adds a +1 to a duplicate instead of filing again." },
  { name: "confirm_and_file", label: "Ask & file", description: "Shows you an editable draft; files only after you approve." },
  { name: "file_complaint", label: "Auto-file", description: "Files directly and returns a tracking ID (Auto mode)." },
  { name: "get_status", label: "Get status", description: "Reads live status and officer notes from the AMC system." },
  { name: "list_my_complaints", label: "List complaints", description: "Lists everything you have filed." },
  { name: "escalate_complaint", label: "Escalate", description: "Escalates an overdue complaint to the zonal officer." },
];
