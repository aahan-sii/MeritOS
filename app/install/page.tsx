import Link from "next/link";
/* eslint-disable @next/next/no-img-element */

export default function InstallExtensionPage() {
  return (
    <main className="install-page">
      <nav className="install-nav">
        <Link href="/" className="install-brand" aria-label="Back to MeritOS home"><img src="/meritos-mark-v2.png" alt="" /><span><strong>MeritOS</strong><small>Application intelligence</small></span></Link>
        <Link className="text-button" href="/">Back to MeritOS</Link>
      </nav>
      <section className="install-hero">
        <div className="install-mark"><img src="/meritos-mark-v2.png" alt="" /></div>
        <span className="eyebrow">MeritOS for desktop Chrome</span>
        <h1>Your application assistant, beside the form.</h1>
        <p>On a Mac, Windows PC, or Chromebook, install once and connect your verified profile. MeritOS then appears beside supported application forms.</p>
        <a className="primary-button install-download" href="/MeritOS-Chrome-Extension.zip" download>Download for Chrome <span aria-hidden="true">↓</span></a>
        <small className="install-note">Chrome requires you to approve an extension before it can run. MeritOS never submits forms.</small>
        <aside className="install-device-note">
          <strong>Using an iPhone?</strong>
          <span>Use the MeritOS website to review matches, answer exceptions, and approve a batch. Continue on desktop Chrome when a form is ready to fill.</span>
        </aside>
      </section>
      <section className="install-steps" aria-label="Chrome extension installation steps">
        <article><span>1</span><div><strong>Download and unzip</strong><p>Open the downloaded ZIP, then choose <em>Extract all</em>.</p></div></article>
        <article><span>2</span><div><strong>Open Chrome Extensions</strong><p>Go to <code>chrome://extensions</code> and turn on Developer mode.</p></div></article>
        <article><span>3</span><div><strong>Load MeritOS</strong><p>Select <em>Load unpacked</em>, then pick the extracted <em>extension</em> folder.</p></div></article>
        <article><span>4</span><div><strong>Connect your profile</strong><p>In MeritOS, create a connection key once and paste it into the MeritOS side panel.</p></div></article>
      </section>
      <p className="install-store-note">For true one-click installation and automatic updates, MeritOS needs a Chrome Web Store listing. This download is the secure developer-install version.</p>
    </main>
  );
}
