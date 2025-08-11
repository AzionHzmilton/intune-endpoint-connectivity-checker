import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TestMethodology = () => {
  const pageTitle = 'Intune Connectivity Test Methodology';

  useEffect(() => {
    // Title
    document.title = pageTitle;

    // Meta description
    const ensureMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    ensureMeta(
      'description',
      'One-page summary of how endpoint connectivity tests work, including HTTPS→HTTP fallback, STUN (UDP inference), batching, and limitations.'
    );

    // Canonical
    const canonicalHref = `${window.location.origin}/docs/test-methodology`;
    let linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.setAttribute('rel', 'canonical');
      document.head.appendChild(linkEl);
    }
    linkEl.setAttribute('href', canonicalHref);

    // Structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: pageTitle,
      description:
        'Summary of endpoint connectivity tests, HTTPS→HTTP fallback, STUN (UDP inference), batching, and known limitations.',
      datePublished: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      mainEntityOfPage: canonicalHref,
    });
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <main className="min-h-screen bg-background p-6">
      <article className="max-w-4xl mx-auto space-y-6">
        <header className="text-center space-y-3">
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground">
            A concise overview of how this app tests Microsoft Intune connectivity from your browser.
          </p>
        </header>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>1) Data source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                Endpoints are fetched from Microsoft&apos;s official Endpoints API (ServiceAreas = MEM) via a CORS proxy. You can
                choose to test FQDNs (URLs) or IP ranges.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>2) Connectivity test flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>For HTTP-capable targets, the app issues a HEAD request over HTTPS first.</li>
                <li>If HTTPS times out or is blocked, it automatically falls back to HTTP HEAD.</li>
                <li>For UDP-like checks, a lightweight WebRTC STUN/ICE probe is used to infer UDP reachability.</li>
              </ol>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>3) Success criteria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Any valid HTTPS HEAD response is marked as success.</li>
                <li>If HTTPS times out but HTTP HEAD returns a response, it is still counted as success.</li>
                <li>STUN/ICE candidates discovered imply UDP pathways likely work (informational).</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>4) Batching, progress, and timing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                Endpoints are tested in concurrent batches with a per-endpoint timeout (configurable in seconds). Progress and
                the current item under test are displayed during execution.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>5) Browser limitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Raw TCP/UDP port checks aren&apos;t possible in browsers; HTTP/HTTPS and WebRTC are used instead.</li>
                <li>
                  Some cross-origin requests may show &quot;Failed to fetch&quot; or status 0 due to CORS/security policies even if the
                  endpoint is reachable outside the browser.
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>6) Results and export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                Each result records URL/IP, status, response time, method used (HTTPS, HTTP, or STUN/ICE), and any error text.
                You can export the current table to CSV from the Test Results panel.
              </p>
            </CardContent>
          </Card>
        </section>
      </article>
    </main>
  );
};

export default TestMethodology;
