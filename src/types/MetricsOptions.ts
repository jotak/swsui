import { MetricsQuery } from '@kiali/k-charted-pf4';

export interface IstioMetricsOptions extends MetricsQuery {
  direction: Direction;
  filters?: string[];
  requestProtocol?: string;
  reporter: Reporter;
}

export type Reporter = 'source' | 'destination';
export type Direction = 'inbound' | 'outbound';

export interface MetricsStatsQuery {
  namespace: string;
  name: string;
  kind: 'app' | 'service' | 'workload';
  queryTime: number;
  interval: string;
  direction: Direction;
  avg: boolean;
  quantiles: string[];
}
