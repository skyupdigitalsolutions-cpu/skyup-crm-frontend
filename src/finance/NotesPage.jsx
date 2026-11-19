// src/finance/NotesPage.jsx — Finance Dashboard → Notes (date-wise log with an Add button).
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { listNotes, createNote, deleteNote } from "./hrApi";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500 dark:border-[#2A3040] dark:bg-[#141925] dark:text-slate-100";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const fmtDay = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

export default function NotesPage() {
  const [list, setList] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { try { const d = await listNotes(); setList(d.notes || []); } catch { setList([]); toast.error("Could not load notes."); } };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!text.trim()) { toast.error("Write something first."); return; }
    setBusy(true);
    try { await createNote({ noteDate: date, description: text.trim() }); setText(""); toast.success("Note added"); load(); }
    catch { toast.error("Could not add note."); } finally { setBusy(false); }
  };
  const remove = async (n) => { if (!window.confirm("Delete this note?")) return; try { await deleteNote(n._id); load(); } catch { toast.error("Could not delete."); } };

  // group by day
  const groups = (list || []).reduce((m, n) => { const k = String(n.noteDate).slice(0, 10); (m[k] = m[k] || []).push(n); return m; }, {});
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 rounded-xl border border-slate-200 p-3 dark:border-[#1F2533]">
        <div className="mb-2 flex items-center gap-2">
          <input type="date" className={`${inputCls} w-auto`} value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="text-[12px] text-slate-400">note date</span>
        </div>
        <textarea className={inputCls} rows={3} placeholder="Write a note…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }} />
        <div className="mt-2 flex justify-end"><button className={btnPrimary} disabled={busy} onClick={add}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add</button></div>
      </div>

      {list === null ? <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : days.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-500 dark:border-[#2A3040]">No notes yet.</div>
        : days.map((day) => (
          <div key={day} className="mb-4">
            <p className="mb-1.5 text-[12px] font-semibold text-slate-500">{fmtDay(day)}</p>
            <div className="space-y-2">
              {groups[day].map((n) => (
                <div key={n._id} className="group flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[13px] dark:border-[#1F2533] dark:bg-[#0F141E]">
                  <p className="whitespace-pre-wrap">{n.description}</p>
                  <button className="rounded-lg p-1 opacity-0 hover:bg-slate-100 group-hover:opacity-100 dark:hover:bg-[#1A2030]" onClick={() => remove(n)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
