export interface Metrics {
  metrics: { [key: string]: MetricGroup };
  histograms: { [key: string]: Histogram };
}

export type Histogram = { [key: string]: MetricGroup };

export interface MetricGroup {
  matrix: TimeSeries[];
}

export type Metric = {
  [key: string]: string;
};

export interface TimeSeries {
  metric: Metric;
  values: Datapoint[];
  name: string;
}

// First is timestamp, second is value
export type Datapoint = [number, number];

export enum MetricsObjectTypes {
  SERVICE,
  WORKLOAD,
  APP
}

export interface MetricsStatsResult {
  stats: { [key: string]: MetricsStats };
  // Note: warnings here is for non-blocking errors, it's set when some stats are available, but not all, for instance due to inaccessible namespaces
  // For more serious errors (e.g. prometheus inaccessible) the query would return an HTTP error
  warnings?: string[];
}

export interface MetricsStats {
  responseTimes: ResponseTimeStats[];
}

export interface ResponseTimeStats {
  peer: string;
  peerNamespace: string;
  values: { [key: string]: number };
}
