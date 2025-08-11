export interface ProxyDetectionResult {
  isProxyDetected: boolean;
  confidence: 'high' | 'medium' | 'low';
  detectionMethods: string[];
  details: {
    externalIP?: string;
    localIPs?: string[];
    headers?: Record<string, string>;
    timing?: number;
  };
}

export class ProxyDetectionService {
  private static async getExternalIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(5000)
      });
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  }

  private static async getLocalIPs(): Promise<string[]> {
    return new Promise((resolve) => {
      const ips: string[] = [];
      
      if (!window.RTCPeerConnection) {
        resolve(ips);
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.createDataChannel('');
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          pc.close();
          resolve(ips);
          return;
        }

        const candidate = e.candidate.candidate;
        const match = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (match && !ips.includes(match[1])) {
          ips.push(match[1]);
        }
      };

      pc.createOffer().then(offer => pc.setLocalDescription(offer));

      // Timeout after 3 seconds
      setTimeout(() => {
        pc.close();
        resolve(ips);
      }, 3000);
    });
  }

  private static async checkProxyHeaders(): Promise<{ detected: boolean; headers: Record<string, string> }> {
    try {
      // Test with a service that returns headers
      const response = await fetch('https://httpbin.org/headers', {
        signal: AbortSignal.timeout(5000)
      });
      const data = await response.json();
      const headers = data.headers || {};

      const proxyHeaders = [
        'Via', 'X-Forwarded-For', 'X-Forwarded-Host', 'X-Forwarded-Proto',
        'X-Real-IP', 'X-Proxy-Authorization', 'Proxy-Authorization',
        'X-Forwarded-Server', 'X-Cluster-Client-IP'
      ];

      const detectedHeaders: Record<string, string> = {};
      let hasProxyHeaders = false;

      for (const header of proxyHeaders) {
        if (headers[header] || headers[header.toLowerCase()]) {
          detectedHeaders[header] = headers[header] || headers[header.toLowerCase()];
          hasProxyHeaders = true;
        }
      }

      return { detected: hasProxyHeaders, headers: detectedHeaders };
    } catch {
      return { detected: false, headers: {} };
    }
  }

  private static async measureLatency(): Promise<number> {
    const start = performance.now();
    try {
      await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      // Ignore errors, we're just measuring timing
    }
    return performance.now() - start;
  }

  public static async detectProxy(): Promise<ProxyDetectionResult> {
    const [externalIP, localIPs, headerCheck, latency] = await Promise.all([
      this.getExternalIP(),
      this.getLocalIPs(),
      this.checkProxyHeaders(),
      this.measureLatency()
    ]);

    const detectionMethods: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for proxy headers (high confidence)
    if (headerCheck.detected) {
      detectionMethods.push('Proxy headers detected');
      confidence = 'high';
    }

    // Check for IP mismatch (medium confidence)
    if (externalIP && localIPs.length > 0) {
      const isLocalIPPublic = localIPs.some(ip => !this.isPrivateIP(ip));
      if (isLocalIPPublic && !localIPs.includes(externalIP)) {
        detectionMethods.push('IP address mismatch');
        if (confidence === 'low') confidence = 'medium';
      }
    }

    // Check for high latency (low confidence)
    if (latency > 1000) {
      detectionMethods.push('High network timing detected (>1000ms)');
    }

    // Check for typical proxy indicators
    if (localIPs.length === 0) {
      detectionMethods.push('WebRTC blocked (possible proxy)');
    }

    const isProxyDetected = detectionMethods.length > 0;

    return {
      isProxyDetected,
      confidence,
      detectionMethods,
      details: {
        externalIP,
        localIPs,
        headers: headerCheck.headers,
        timing: latency
      }
    };
  }

  private static isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    // Check for private IP ranges
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127
    );
  }
}