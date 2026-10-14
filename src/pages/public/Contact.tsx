import React, { useState } from "react";
import { Mail, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <PageHeader
        title="Contact Hostel Office"
        subtitle="Get in touch with RGMCET hostel administration for admissions, inquiries, or feedback"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Contact Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Send Us a Message</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fill out the form below and our staff will respond within 24 hours.</p>

          {submitted ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center dark:bg-emerald-950/40 dark:border-emerald-900">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h4 className="mt-3 text-base font-bold text-emerald-900 dark:text-emerald-200">Message Received!</h4>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Thank you for reaching out. We have logged your query.</p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                className="mt-4 text-xs font-bold text-indigo-600 underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ramesh Reddy"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Hostel Admission / Gate Pass Inquiry"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Message Content</label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Write your detailed message here..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Send className="h-4 w-4" /> Send Message
              </button>
            </form>
          )}
        </div>

        {/* Office Details & Map */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Hostel Office Information</h3>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Campus Address</h4>
                <p className="text-xs text-slate-500">Rajeev Gandhi Memorial College of Engineering & Technology (Autonomous), NH-40, Nandyal - 518501, Andhra Pradesh, India</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Phone Helplines</h4>
                <p className="text-xs text-slate-500">+91 8514 275201 / 275203 (Office Hours: 9 AM - 5 PM)</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Official Email</h4>
                <p className="text-xs text-indigo-600 font-semibold">hostel@rgmcet.edu.in</p>
              </div>
            </div>
          </div>

          {/* Map Placeholder Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-md text-center space-y-3">
            <h4 className="text-sm font-extrabold">RGMCET Nandyal Campus Location</h4>
            <p className="text-xs text-slate-400">Located on NH-40, 10 km from Nandyal Railway Station.</p>
            <div className="h-40 w-full rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 text-xs text-indigo-400 font-mono">
              📍 Google Maps Embed: RGMCET Nandyal Campus (15.4746° N, 78.4812° E)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
