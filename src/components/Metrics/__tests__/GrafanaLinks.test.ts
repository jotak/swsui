import { GrafanaLinks } from '../GrafanaLinks';
import { MetricsObjectTypes } from 'types/Metrics';

describe('Grafana links', () => {
  it('build service links', () => {
    const links = GrafanaLinks.buildGrafanaLinks({
      links: [
        {
          name: 'View in Grafana',
          url: 'http://grafana:3000',
          variables: { namespace: 'var-namespace', service: 'var-service' }
        },
        {
          name: 'View in Grafana 2',
          url: 'http://grafana:3000?orgId=1',
          variables: { namespace: 'var-namespace', service: 'var-service' }
        }
      ],
      namespace: 'my-namespace',
      object: 'my-service',
      objectType: MetricsObjectTypes.SERVICE
    });
    expect(links).toHaveLength(2);
    expect(links[0][0]).toEqual('View in Grafana');
    expect(links[0][1]).toEqual(
      'http://grafana:3000?var-service=my-service.my-namespace.svc.cluster.local&var-namespace=my-namespace'
    );
    expect(links[1][0]).toEqual('View in Grafana 2');
    expect(links[1][1]).toEqual(
      'http://grafana:3000?orgId=1&var-service=my-service.my-namespace.svc.cluster.local&var-namespace=my-namespace'
    );
  });

  it('build workload links', () => {
    const links = GrafanaLinks.buildGrafanaLinks({
      links: [
        {
          name: 'View in Grafana',
          url: 'http://grafana:3000',
          variables: { namespace: 'var-namespace', workload: 'var-workload' }
        },
        {
          name: 'View in Grafana 2',
          url: 'http://grafana:3000?orgId=1',
          variables: { namespace: 'var-namespace', workload: 'var-workload' }
        }
      ],
      namespace: 'my-namespace',
      object: 'my-workload',
      objectType: MetricsObjectTypes.WORKLOAD
    });
    expect(links).toHaveLength(2);
    expect(links[0][0]).toEqual('View in Grafana');
    expect(links[0][1]).toEqual('http://grafana:3000?var-workload=my-workload&var-namespace=my-namespace');
    expect(links[1][0]).toEqual('View in Grafana 2');
    expect(links[1][1]).toEqual('http://grafana:3000?orgId=1&var-workload=my-workload&var-namespace=my-namespace');
  });

  it('build app links', () => {
    const links = GrafanaLinks.buildGrafanaLinks({
      links: [
        {
          name: 'View in Grafana',
          url: 'http://grafana:3000',
          variables: { namespace: 'var-namespace', app: 'var-app', version: 'var-version' }
        },
        {
          name: 'View in Grafana 2',
          url: 'http://grafana:3000?orgId=1',
          variables: { namespace: 'var-namespace', app: 'var-app' }
        }
      ],
      namespace: 'my-namespace',
      object: 'my-app',
      objectType: MetricsObjectTypes.APP,
      version: 'v1'
    });
    expect(links).toHaveLength(2);
    expect(links[0][0]).toEqual('View in Grafana');
    expect(links[0][1]).toEqual('http://grafana:3000?var-app=my-app&var-namespace=my-namespace&var-version=v1');
    expect(links[1][0]).toEqual('View in Grafana 2');
    expect(links[1][1]).toEqual('http://grafana:3000?orgId=1&var-app=my-app&var-namespace=my-namespace');
  });

  it('build static links', () => {
    const links = GrafanaLinks.buildGrafanaLinks({
      links: [
        {
          name: 'Dashboard 1',
          url: 'http://grafana:3000',
          variables: {}
        },
        {
          name: 'Dashboard 2',
          url: 'http://grafana:3000?orgId=1',
          variables: {}
        },
        {
          name: 'Dashboard 3',
          url: 'http://grafana:3000?orgId=1',
          variables: { namespace: 'var-namespace' }
        }
      ],
      namespace: 'my-namespace',
      object: 'my-app',
      objectType: MetricsObjectTypes.APP,
      version: 'v1'
    });
    expect(links).toHaveLength(3);
    expect(links[0][0]).toEqual('Dashboard 1');
    expect(links[0][1]).toEqual('http://grafana:3000');
    expect(links[1][0]).toEqual('Dashboard 2');
    expect(links[1][1]).toEqual('http://grafana:3000?orgId=1');
    expect(links[2][0]).toEqual('Dashboard 3');
    expect(links[2][1]).toEqual('http://grafana:3000?orgId=1&var-namespace=my-namespace');
  });
});
