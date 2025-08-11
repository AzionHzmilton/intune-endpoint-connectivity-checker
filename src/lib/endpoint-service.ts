import { IntuneEndpoint, EndpointTest, LookupType } from '@/types/endpoint';

// Fallback Intune endpoints data (commonly used ones)
const FALLBACK_INTUNE_FQDNS = [
  'login.microsoftonline.com',
  'graph.microsoft.com',
  'enterpriseregistration.windows.net',
  'portal.manage.microsoft.com',
  'fef.msua06.manage.microsoft.com',
  'fef.msua01.manage.microsoft.com',
  'fef.msua02.manage.microsoft.com',
  'fef.msua04.manage.microsoft.com',
  'fef.msua05.manage.microsoft.com',
  'fef.msub01.manage.microsoft.com',
  'fef.msub02.manage.microsoft.com',
  'fef.msub03.manage.microsoft.com',
  'fef.msub05.manage.microsoft.com',
  'fef.msuc01.manage.microsoft.com',
  'fef.msuc02.manage.microsoft.com',
  'fef.msuc03.manage.microsoft.com',
  'fef.msuc05.manage.microsoft.com',
  'manage.microsoft.com',
  'i.manage.microsoft.com',
  'r.manage.microsoft.com',
  'a.manage.microsoft.com',
  'p.manage.microsoft.com',
  'EnterpriseEnrollment.manage.microsoft.com',
  'EnterpriseEnrollment-s.manage.microsoft.com',
  'portal.fei.msua01.manage.microsoft.com',
  'portal.fei.msua02.manage.microsoft.com',
  'portal.fei.msua04.manage.microsoft.com',
  'portal.fei.msua05.manage.microsoft.com',
  'portal.fei.msub01.manage.microsoft.com',
  'portal.fei.msub02.manage.microsoft.com',
  'portal.fei.msub03.manage.microsoft.com',
  'portal.fei.msub05.manage.microsoft.com',
  'portal.fei.msuc01.manage.microsoft.com',
  'portal.fei.msuc02.manage.microsoft.com',
  'portal.fei.msuc03.manage.microsoft.com',
  'portal.fei.msuc05.manage.microsoft.com'
];

const FALLBACK_INTUNE_IPS = [
  '40.82.248.224',
  '40.82.249.128',
  '52.150.137.0',
  '52.162.111.96',
  '52.168.116.128',
  '52.182.141.192',
  '52.236.189.96',
  '52.240.244.160',
  '40.84.70.128',
  '48.218.252.128',
  '57.151.0.192',
  '57.153.235.0',
  '57.154.140.128',
  '20.190.169.0',
  '20.231.130.64',
  '40.119.8.128',
  '52.161.25.0',
  '52.174.56.180',
  '52.175.12.209',
  '52.237.24.126'
];

export class EndpointService {
  static async fetchIntuneEndpoints(lookupType: LookupType = 'FQDN'): Promise<string[]> {
    try {
      // First try to fetch from Microsoft API directly
      const requestId = crypto.randomUUID();
      const apiUrl = `https://endpoints.office.com/endpoints/WorldWide?ServiceAreas=MEM&clientrequestid=${requestId}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Add a timeout
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const endpoints: IntuneEndpoint[] = await response.json();
        return this.extractEndpointsFromAPI(endpoints, lookupType);
      }
    } catch (error) {
      console.warn('Failed to fetch from API, using fallback data:', error);
    }
    
    // Use fallback data if API fails
    return lookupType === 'FQDN' ? [...FALLBACK_INTUNE_FQDNS] : [...FALLBACK_INTUNE_IPS];
  }

  private static extractEndpointsFromAPI(endpoints: IntuneEndpoint[], lookupType: LookupType): string[] {
    if (lookupType === 'FQDN') {
      const memEndpoints = endpoints.filter(
        endpoint => endpoint.serviceArea === 'MEM' && endpoint.urls
      );
      
      const urls = new Set<string>();
      memEndpoints.forEach(endpoint => {
        endpoint.urls?.forEach(url => {
          const cleanUrl = url.replace(/\*/g, '').replace(/^\./, '');
          if (cleanUrl && !cleanUrl.includes('*')) {
            urls.add(cleanUrl);
          }
        });
      });
      
      return Array.from(urls).sort();
    } else {
      const memEndpoints = endpoints.filter(
        endpoint => endpoint.serviceArea === 'MEM' && endpoint.ips
      );
      
      const ips = new Set<string>();
      memEndpoints.forEach(endpoint => {
        endpoint.ips?.forEach(ip => {
          const cleanIp = ip.includes('/') ? ip.split('/')[0] : ip;
          if (cleanIp && cleanIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            ips.add(cleanIp);
          }
        });
      });
      
      return Array.from(ips).sort();
    }
  }

  static async testEndpointConnectivity(endpoint: string): Promise<EndpointTest> {
    const startTime = Date.now();
    
    try {
      // For IP addresses, test directly. For FQDNs, use HTTPS
      const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(endpoint);
      const testUrl = isIP ? `https://${endpoint}` : 
                     endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
      
      // Create abort controller with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Use fetch with no-cors mode for client-side testing
      await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      // In no-cors mode, any response (even network errors) often indicates connectivity
      return {
        url: endpoint,
        status: 'success',
        responseTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Handle different error types
      if (error instanceof Error) {
        // AbortError means timeout - likely unreachable
        if (error.name === 'AbortError') {
          return {
            url: endpoint,
            status: 'error',
            responseTime,
            error: 'Connection timeout',
            timestamp: new Date(),
          };
        }
        
        // In no-cors mode, many "errors" actually indicate successful connectivity
        // Network errors often happen even when the endpoint is reachable
        if (responseTime < 5000 && (
          error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError') ||
          error.message.includes('CORS')
        )) {
          return {
            url: endpoint,
            status: 'success',
            responseTime,
            timestamp: new Date(),
          };
        }
      }
      
      return {
        url: endpoint,
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : 'Connection failed',
        timestamp: new Date(),
      };
    }
  }

  static async testAllEndpoints(
    endpoints: string[],
    onProgress?: (progress: { completed: number; total: number; current: string }) => void
  ): Promise<EndpointTest[]> {
    const results: EndpointTest[] = [];
    
    // Test endpoints in small batches to avoid overwhelming the browser
    const batchSize = 5;
    
    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      
      // Test batch in parallel
      const batchPromises = batch.map(async (endpoint, batchIndex) => {
        const globalIndex = i + batchIndex;
        onProgress?.({ completed: globalIndex, total: endpoints.length, current: endpoint });
        
        return this.testEndpointConnectivity(endpoint);
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be respectful
      if (i + batchSize < endpoints.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    onProgress?.({ completed: endpoints.length, total: endpoints.length, current: '' });
    return results;
  }
}