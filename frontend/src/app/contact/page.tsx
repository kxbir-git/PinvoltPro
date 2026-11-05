'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.message) return;
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
      {/* Navigation */}
      <nav className="w-full bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="PinVault Pro" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="text-xl font-bold tracking-tight text-slate-800">
              PinVault<span className="text-blue-500">Pro</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 transition-colors"
          >
            ← Back to Downloader
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full border border-blue-100 mb-3">
            Get in Touch
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Contact Support & Inquiries
          </h1>
          <p className="text-slate-500 text-sm sm:text-base mt-2">
            Have questions, feedback, or a DMCA inquiry? We usually respond within 24-48 business hours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Contact Details Card */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-1">Email Us Directly</h3>
              <p className="text-xs text-slate-500 mb-3">For general questions and copyright notices:</p>
              <a
                href="mailto:contact.pinvaultpro@gmail.com"
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 break-all font-mono"
              >
                contact.pinvaultpro@gmail.com
              </a>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
              <h3 className="font-bold text-slate-800 text-sm mb-2">Frequently Answered</h3>
              <ul className="text-xs text-slate-600 space-y-2">
                <li>• <strong>Is it free?</strong> Yes, 100% free with no limits.</li>
                <li>• <strong>Audio included?</strong> Yes, all HD MP4s keep original sound.</li>
                <li>• <strong>No registration:</strong> We never ask for your passwords or credentials.</li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
              {isSubmitted ? (
                <div className="text-center py-12 animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Message Received!</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                    Thank you for reaching out. We have received your inquiry and will review it shortly.
                  </p>
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormData({ name: '', email: '', subject: 'General Inquiry', message: '' });
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-sm transition-all"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Your Email</label>
                    <input
                      type="email"
                      required
                      placeholder="jane@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="DMCA / Copyright Notice">DMCA / Copyright Notice</option>
                      <option value="Bug Report / Download Issue">Bug Report / Download Issue</option>
                      <option value="Advertising / Business">Advertising / Business</option>
                      <option value="Feedback & Suggestions">Feedback & Suggestions</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Message</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="How can we help you? Please describe your query or provide the specific Pinterest URL..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all active:scale-98"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PinVault Pro. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/dmca" className="hover:text-white">DMCA</Link>
            <Link href="/contact" className="text-white hover:underline">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
