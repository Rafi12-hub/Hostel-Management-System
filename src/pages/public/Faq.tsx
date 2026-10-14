import React, { useState } from "react";
import { HelpCircle, ChevronDown, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Faq() {
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "How do I apply for a Gate Pass for local visits?",
      a: "Log in to the Hostel Hub portal using your student credentials, navigate to Gate Pass, fill out destination and expected return time, and submit. Your Warden will review and approve it. Show the generated QR code to Security at the main gate when exiting.",
    },
    {
      q: "What is the procedure for taking out-of-station Leave?",
      a: "Go to Leave Requests in your portal, select from/to dates, enter reason & emergency contact, and submit. For leaves longer than 2 days, your parent must confirm via phone call to the Warden office before final approval.",
    },
    {
      q: "How do I lodge a maintenance complaint for electrical or plumbing issues in my room?",
      a: "Navigate to Maintenance in your portal dashboard, click 'Report New Issue', select the category (e.g. Electrical, Plumbing, Wi-Fi), attach an optional photo, and submit. You can track SLA resolution status in real time.",
    },
    {
      q: "What are the night roll call timings and curfew rules?",
      a: "Daily night roll call takes place strictly at 9:00 PM in block lobbies. All residents must be physically present inside their respective hostel blocks by 9:00 PM.",
    },
    {
      q: "Can parents or relatives stay overnight in the hostel?",
      a: "No, overnight stay of visitors or parents inside student rooms is strictly prohibited. Parents can visit during daytime visiting hours (10:00 AM to 6:00 PM) at the hostel reception parlor.",
    },
    {
      q: "What should I do in case of a medical emergency during night hours?",
      a: "Contact the Resident Medical Officer (RMO) directly at extension 404 / +91 8514 275201, or call the 24/7 campus ambulance. The ambulance is available around the clock.",
    },
    {
      q: "Is Wi-Fi available in all hostel rooms?",
      a: "Yes, high-speed Wi-Fi 6 routers are installed across all floors in APJ Abdul Kalam, CV Raman, and Kalpana Chawla hostels.",
    },
    {
      q: "How do I give feedback about mess food quality?",
      a: "Go to Mess & Dining in your dashboard and click 'Submit Food Feedback'. You can rate taste, cleanliness, and quality and leave detailed suggestions for the Mess Manager.",
    },
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <PageHeader
        title="Frequently Asked Questions"
        subtitle="Quick answers to common questions about hostel admissions, gate passes, mess, and rules"
      />

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search questions (e.g. gate pass, leave, medical, mess)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 py-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-4">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="flex w-full items-center justify-between p-5 text-left text-sm font-extrabold text-slate-900 dark:text-white"
              >
                <span className="flex items-center gap-3">
                  <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                  {faq.q}
                </span>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
