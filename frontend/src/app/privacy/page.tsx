import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — PinVault Pro',
  description: 'Privacy Policy for PinVault Pro Pinterest Video Downloader.',
};

export default function PrivacyPage() {
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
          <span className="inline-block px-3 py-1 bg-green-50 text-green-600 text-xs font-semibold rounded-full border border-green-100 mb-3">
            Privacy First
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-slate-500 text-sm mt-2">Last updated: November 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-600">
          <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Our Commitment to Your Privacy</h2>
            <p>
              At <strong>PinVault Pro</strong>, we believe privacy is a fundamental right. We do not require you to create an account, register, or provide any personal details (such as names, passwords, or telephone numbers) to download Pinterest videos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">1. Information We Do NOT Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>We do <strong>not</strong> collect personal identifying information.</li>
              <li>We do <strong>not</strong> store or keep archives of the videos, audio files, or images you download. All download operations are processed on-the-fly and streamed directly to your browser.</li>
              <li>We do <strong>not</strong> sell, rent, or trade user data to any third party.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">2. Automatically Collected Technical Data</h2>
            <p>
              Like almost all websites, our servers may automatically collect standard web server logs when you visit our pages. This may include your IP address, browser type, referring pages, operating system, and timestamp. This data is used solely for traffic monitoring, security analysis, and server load management.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">3. Cookies and Web Beacons</h2>
            <p>
              PinVault Pro may use basic session cookies to enhance your browsing experience. Additionally, third-party advertising partners (such as Google AdSense) may use cookies, web beacons, and JavaScript to serve relevant advertisements based on your visit to this and other websites on the internet.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              You can choose to disable cookies through your individual browser options. Detailed information about cookie management with specific web browsers can be found at the browsers&apos; respective websites.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">4. Third-Party Links</h2>
            <p>
              Our website may contain links to external sites or advertisements. We are not responsible for the privacy practices, content, or policies of third-party platforms. We encourage you to review the privacy statements of any site you visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">5. Children&apos;s Information</h2>
            <p>
              PinVault Pro does not knowingly collect any personally identifiable information from children under the age of 13. If you believe your child provided this kind of information on our website, please contact us immediately and we will promptly remove such information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-3">6. Updates to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted directly on this page with an updated &quot;Last updated&quot; date.
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
            <Link href="/privacy" className="text-white hover:underline">Privacy</Link>
            <Link href="/dmca" className="hover:text-white">DMCA</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

