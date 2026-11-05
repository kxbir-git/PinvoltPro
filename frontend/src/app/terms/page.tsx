import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — PinVault Pro',
  description: 'Terms of Service for PinVault Pro Pinterest Video Downloader.',
};

export default function TermsPage() {
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
      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="mb-10">
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full border border-blue-100 mb-3">
            Legal Agreement
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-slate-500 text-sm mt-2">Last updated: November 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-600">
          <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
            <h2 className="text-lg font-bold text-slate-800 mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing and using <strong>PinVault Pro</strong> (the &quot;Service&quot;), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Description of Service</h2>
            <p>
              PinVault Pro is a web-based educational and productivity utility designed to allow users to retrieve and download publicly available media (videos, Idea Pins, images, GIFs) from Pinterest for personal, offline, and non-commercial viewing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Disclaimer of Affiliation</h2>
            <p className="bg-amber-50 text-amber-900 p-4 rounded-xl border border-amber-200 text-sm">
              <strong>Notice:</strong> PinVault Pro is an independent third-party tool and is <strong>NOT</strong> affiliated, associated, authorized, endorsed by, or in any way officially connected with Pinterest, Inc. or any of its subsidiaries or affiliates. The name &quot;Pinterest&quot; as well as related names, marks, emblems, and images are registered trademarks of their respective owners.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Permitted and Prohibited Uses</h2>
            <p className="mb-2">When using our Service, you agree that:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>You will only download content for personal, private, and non-commercial purposes.</li>
              <li>You will respect the intellectual property rights of content owners and creators.</li>
              <li>You will not redistribute, re-upload, sell, or commercially exploit any content downloaded via PinVault Pro without permission from the copyright owner.</li>
              <li>You will not attempt to bypass, disable, or tamper with security features of the website or overload our infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. PinVault Pro makes no warranties, expressed or implied, regarding the continuous availability, accuracy, reliability, or compatibility of the downloader with third-party platforms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">6. Limitation of Liability</h2>
            <p>
              Under no circumstances shall PinVault Pro or its operators be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use this Service or from any content downloaded through this utility.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">7. Modifications to Terms</h2>
            <p>
              We reserve the right to revise these Terms of Service at any time without prior notice. Continued use of the website following any changes constitutes your binding acceptance of the updated terms.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PinVault Pro. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="text-white hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/dmca" className="hover:text-white">DMCA</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
