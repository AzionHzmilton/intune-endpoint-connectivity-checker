export interface ProxyDetectionResult {
  isProxyDetected: boolean;
  confidence: 'high' | 'medium' | 'low';
  detectionMethods: string[];
  sslInspection?: {
    detected: boolean;
    details: string[];
  };
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

  private static async checkSSLInspection(): Promise<{ detected: boolean; details: string[] }> {
    const details: string[] = [];
    let detected = false;

    try {
      // Test multiple HTTPS endpoints to detect SSL inspection
      const testSites = [
        'https://www.google.com',
        'https://github.com',
        'https://stackoverflow.com'
      ];

      const promises = testSites.map(async (url) => {
        try {
          const startTime = performance.now();
          const response = await fetch(url, {
            method: 'HEAD',
            mode: 'cors',
            signal: AbortSignal.timeout(5000)
          });
          const endTime = performance.now();

          // Check for SSL inspection indicators
          const headers = Array.from(response.headers.entries());
          
          // Look for corporate/proxy SSL certificate indicators
          const suspiciousHeaders = headers.filter(([key, value]) => {
            const lowerKey = key.toLowerCase();
            const lowerValue = value.toLowerCase();
            
            return (
              lowerKey.includes('proxy') ||
              lowerKey.includes('firewall') ||
              lowerKey.includes('security') ||
              lowerValue.includes('corporate') ||
              lowerValue.includes('inspection') ||
              lowerValue.includes('zscaler') ||
              lowerValue.includes('bluecoat') ||
              lowerValue.includes('forcepoint') ||
              lowerValue.includes('websense')
            );
          });

          if (suspiciousHeaders.length > 0) {
            detected = true;
            details.push(`SSL inspection headers found for ${new URL(url).hostname}`);
          }

          // Check for unusually long SSL handshake times (may indicate inspection)
          if (endTime - startTime > 2000) {
            details.push(`Slow SSL handshake to ${new URL(url).hostname} (${Math.round(endTime - startTime)}ms)`);
          }

        } catch (error) {
          // CORS errors are expected and don't indicate SSL inspection
          if (error instanceof Error && !error.message.includes('CORS')) {
            details.push(`SSL connection failed to ${new URL(url).hostname}: ${error.message}`);
          }
        }
      });

      await Promise.allSettled(promises);

      // Additional check: Look for mixed content policies that might indicate inspection
      if (window.location.protocol === 'https:') {
        try {
          // Try to detect if WebSocket connections are being intercepted
          const wsTest = new WebSocket('wss://echo.websocket.org');
          
          wsTest.onopen = () => {
            wsTest.close();
          };
          
          wsTest.onerror = () => {
            details.push('WebSocket SSL connection blocked (possible inspection)');
            detected = true;
          };
          
          // Clean up after 2 seconds
          setTimeout(() => {
            if (wsTest.readyState === WebSocket.CONNECTING) {
              wsTest.close();
            }
          }, 2000);
          
        } catch (error) {
          // WebSocket not supported or blocked
        }
      }

      // Check for certificate transparency violations (advanced detection)
      if (navigator.userAgent && !navigator.userAgent.includes('Chrome')) {
        // This is a simplified check - in reality, this would require more complex certificate validation
        details.push('Certificate validation limited in this browser');
      }

    } catch (error) {
      details.push(`SSL inspection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { detected, details };
  }

  public static async detectProxy(): Promise<ProxyDetectionResult> {
    const [externalIP, localIPs, headerCheck, latency, sslInspection] = await Promise.all([
      this.getExternalIP(),
      this.getLocalIPs(),
      this.checkProxyHeaders(),
      this.measureLatency(),
      this.checkSSLInspection()
    ]);

    const detectionMethods: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for proxy headers (high confidence)
    if (headerCheck.detected) {
      detectionMethods.push('Proxy headers detected');
      confidence = 'high';
    }

    // Check for SSL inspection (high confidence)
    if (sslInspection.detected) {
      detectionMethods.push('SSL inspection detected');
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
      sslInspection,
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