export interface Metrics {
  source: ReporterMetrics;
  dest: ReporterMetrics;
}

export interface ReporterMetrics {
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

export enum MetricsDirection {
  INBOUND,
  OUTBOUND
}

export enum MetricsObjectTypes {
  SERVICE,
  WORKLOAD,
  APP
}

export interface Charts {
  title: string;
  charts: Chart[];
}

export interface Chart {
  name: string;
  unit: string;
  spans: number;
  counterRate?: MetricGroup;
  histogram?: Histogram;
  aggregations: Aggregation[];
}

export interface Aggregation {
  label: string;
  displayName: string;
}
