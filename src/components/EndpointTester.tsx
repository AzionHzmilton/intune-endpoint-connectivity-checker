import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EndpointService } from '@/lib/endpoint-service';
import { EndpointTest, TestStats, LookupType } from '@/types/endpoint';
import { Search, RefreshCw, Activity, CheckCircle, XCircle, Clock, Globe, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const EndpointTester = () => {
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<EndpointTest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lookupType, setLookupType] = useState<LookupType>('FQDN');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [testProgress, setTestProgress] = useState({ completed: 0, total: 0, current: '' });
  const { toast } = useToast();

  const stats: TestStats = {
    total: testResults.length,
    tested: testResults.filter(r => r.status !== 'pending').length,
    successful: testResults.filter(r => r.status === 'success').length,
    failed: testResults.filter(r => r.status === 'error').length,
    pending: testResults.filter(r => r.status === 'pending').length,
  };

  const filteredResults = testResults.filter(result => {
    const matchesSearch = result.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? result.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const handleStatusFilter = (status: string) => {
    setStatusFilter(statusFilter === status ? null : status);
  };

  const loadEndpoints = async () => {
    setIsLoading(true);
    try {
      const endpoints = await EndpointService.fetchMicrosoftEndpoints(lookupType);
      setEndpoints(endpoints);
      setTestResults(endpoints.map(endpoint => ({ url: endpoint, status: 'pending' as const })));
      toast({
        title: "Endpoints loaded",
        description: `Found ${endpoints.length} Intune ${lookupType} endpoints`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load endpoints. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnectivity = async () => {
    if (endpoints.length === 0) return;
    
    setIsTesting(true);
    setTestProgress({ completed: 0, total: endpoints.length, current: '' });
    
    try {
      const results = await EndpointService.testAllEndpoints(
        endpoints,
        (progress) => setTestProgress(progress)
      );
      setTestResults(results);
      
      const successCount = results.filter(r => r.status === 'success').length;
      toast({
        title: "Testing complete",
        description: `${successCount}/${results.length} endpoints are reachable`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test endpoints. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    loadEndpoints();
  }, [lookupType]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Intune Connectivity Tester
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Test network connectivity to Microsoft Intune endpoints required for proper service operation
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Endpoints</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`border-l-4 border-l-success cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'success' ? 'ring-2 ring-success shadow-lg' : ''
            }`}
            onClick={() => handleStatusFilter('success')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold text-success">{stats.successful}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`border-l-4 border-l-destructive cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'error' ? 'ring-2 ring-destructive shadow-lg' : ''
            }`}
            onClick={() => handleStatusFilter('error')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`border-l-4 border-l-warning cursor-pointer transition-all hover:shadow-lg ${
              statusFilter === 'pending' ? 'ring-2 ring-warning shadow-lg' : ''
            }`}
            onClick={() => handleStatusFilter('pending')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lookup Type Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Type</CardTitle>
            <CardDescription>
              Select the type of endpoints to test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={lookupType} onValueChange={(value) => setLookupType(value as LookupType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="FQDN" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  FQDN (URLs)
                </TabsTrigger>
                <TabsTrigger value="IP" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  IP Addresses
                </TabsTrigger>
              </TabsList>
              <TabsContent value="FQDN" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Test connectivity to Intune service URLs (Fully Qualified Domain Names)
                </p>
              </TabsContent>
              <TabsContent value="IP" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Test connectivity to Intune service IP addresses
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Connectivity Testing</CardTitle>
            <CardDescription>
              Load and test Intune endpoint connectivity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={loadEndpoints} 
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Reload Endpoints
              </Button>
              
              <Button 
                onClick={testConnectivity} 
                disabled={isTesting || endpoints.length === 0}
                className="flex items-center gap-2"
                variant="secondary"
              >
                <Activity className={`h-4 w-4 ${isTesting ? 'animate-pulse' : ''}`} />
                Test Connectivity
              </Button>
            </div>

            {isTesting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Testing endpoints...</span>
                  <span>{testProgress.completed}/{testProgress.total}</span>
                </div>
                <Progress value={(testProgress.completed / testProgress.total) * 100} />
                {testProgress.current && (
                  <p className="text-xs text-muted-foreground">
                    Current: {testProgress.current}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search and Results */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Connectivity test results for Intune {lookupType} endpoints
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusFilter && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Filtering by: <strong className="capitalize">{statusFilter}</strong> results
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setStatusFilter(null)}
                  >
                    Clear Filter
                  </Button>
                </div>
              )}
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search endpoints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredResults.map((result) => (
                  <div
                    key={result.url}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm truncate">{result.url}</p>
                      {result.responseTime && (
                        <p className="text-xs text-muted-foreground">
                          Response time: {result.responseTime}ms
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {result.status === 'success' && (
                        <Badge variant="secondary" className="bg-success-muted text-success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                      {result.status === 'error' && (
                        <Badge variant="secondary" className="bg-destructive-muted text-destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                      {result.status === 'pending' && (
                        <Badge variant="secondary" className="bg-warning-muted text-warning">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};