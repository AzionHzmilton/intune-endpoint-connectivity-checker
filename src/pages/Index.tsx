import { EndpointTester } from '@/components/EndpointTester';
import { ProxyDetectionCard } from '@/components/ProxyDetectionCard';

const Index = () => {
  return (
    <div className="space-y-6">
      <ProxyDetectionCard />
      <EndpointTester />
    </div>
  );
};

export default Index;
