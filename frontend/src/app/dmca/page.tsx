import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DMCA & Copyright Policy — PinVault Pro',
  description: 'Digital Millennium Copyright Act (DMCA) and Copyright Infringement policy for PinVault Pro.',
};

export default function DmcaPage() {
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
          <span className="inline-block px-3 py-1 bg-purple-50 text-purple-600 text-xs font-semibold rounded-full border border-purple-100 mb-3">
            Copyright Protection
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            DMCA & Copyright Policy
          </h1>
          <p className="text-slate-500 text-sm mt-2">Digital Millennium Copyright Act Notice</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-600">
          <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Our Stance on Intellectual Property</h2>
            <p>
              <strong>PinVault Pro</strong> respects the intellectual property rights of others and expects our users to do the same. We strictly comply with the Digital Millennium Copyright Act of 1998 (&quot;DMCA&quot;) and other applicable intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. No Content Hosting Disclaimer</h2>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-sm leading-relaxed">
              <strong>Important Notice:</strong> PinVault Pro does <strong>NOT</strong> host, upload, store, or archive any videos, audio, or images on its servers. All media retrieved through our utility is streamed directly from Pinterest&apos;s publicly accessible content delivery network (CDN) servers to the user&apos;s browser. We function strictly as an online utility tool.
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Filing a DMCA Notice</h2>
            <p className="mb-2">
              If you are a copyright owner, or an agent authorized to act on behalf of one, and you believe that any content linked or accessible through PinVault Pro infringes upon your copyright, please submit a written notification with the following information:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                A physical or electronic signature of a person authorized to act on behalf of the owner of the copyright that is allegedly infringed.
              </li>
              <li>
                Identification of the copyrighted work claimed to have been infringed, or a representative list of such works.
              </li>
              <li>
                Identification of the material that is claimed to be infringing (specifically, the Pinterest Pin URL) that you request to be blocked or disabled from our tool.
              </li>
              <li>
                Sufficient contact information, including your full name, mailing address, telephone number, and email address.
              </li>
              <li>
                A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
              </li>
              <li>
                A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the copyright owner.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. How to Submit Your Notice</h2>
            <p>
              Please send DMCA notices via our{' '}
              <Link href="/contact" className="text-blue-600 underline font-medium hover:text-blue-700">
                Contact Page
              </Link>{' '}
              or directly by email to:
            </p>
            <div className="mt-3 p-4 bg-slate-100 rounded-xl font-mono text-sm text-slate-800 inline-block">
              contact.pinvaultpro@gmail.com
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Upon receiving a valid DMCA notice, we will immediately review the request and block the specified Pin URL from being processed by our downloader service within 24-48 business hours.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PinVault Pro. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/dmca" className="text-white hover:underline">DMCA</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

