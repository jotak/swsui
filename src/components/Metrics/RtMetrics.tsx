import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'patternfly-react';
import { style } from 'typestyle';
import assign from 'lodash/fp/assign';

import history from '../../app/History';
import MetricsOptionsBar from '../MetricsOptions/MetricsOptionsBar';
import { MetricsLabels as L } from '../MetricsOptions/MetricsLabels';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import * as M from '../../types/Metrics';
import MetricsOptions from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';

import HistogramChart from './HistogramChart';
import MetricChart from './MetricChart';

const expandedChartContainerStyle = style({
  height: 'calc(100vh - 248px)'
});

const expandedChartBackLinkStyle = style({
  marginTop: '-1.7em',
  textAlign: 'right'
});

type MetricsState = {
  chartDefs?: M.Charts;
  labelValues: Map<L.LabelName, L.LabelValues>;
};

export type RtMetricsProps = {
  namespace: string;
  app: string;
  template: string;
  isPageVisible?: boolean;
};

export class RtMetrics extends React.Component<RtMetricsProps, MetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: MetricsOptions;

  constructor(props: RtMetricsProps) {
    super(props);

    this.state = {
      labelValues: new Map()
    };
  }

  onOptionsChanged = (options: MetricsOptions) => {
    this.options = options;
    const intervalOpts = computePrometheusQueryInterval(options.duration!);
    options.step = intervalOpts.step;
    options.rateInterval = intervalOpts.rateInterval;
    this.fetchMetrics();
  };

  fetchMetrics = () => {
    API.getRuntimeMetrics(authentication(), this.props.namespace, this.props.app, this.props.template, this.options)
      .then(response => {
        const labelValues = this.extractLabelValues(response.data);
        this.setState({
          chartDefs: response.data,
          labelValues: labelValues
        });
      })
      .catch(error => {
        // TODO: use MessageCenter
        console.error(error);
      });
  };

  extractLabelValues(chartDefs: M.Charts): Map<L.LabelName, L.LabelValues> {
    // Find all labels on all series
    const labelsWithValues: Map<L.LabelName, L.LabelValues> = new Map();
    chartDefs.charts.forEach(chart => {
      if (chart.histogram) {
        const histo = chart.histogram;
        Object.keys(histo).forEach(stat => {
          this.extractLabelValuesOnSeries(histo[stat].matrix, chart.aggregations, labelsWithValues);
        });
      } else if (chart.counterRate) {
        this.extractLabelValuesOnSeries(chart.counterRate.matrix, chart.aggregations, labelsWithValues);
      }
    });
    // Keep existing show flag
    labelsWithValues.forEach((values: L.LabelValues, key: L.LabelName) => {
      const previous = this.state.labelValues.get(key);
      if (previous) {
        Object.keys(values).forEach(k => {
          if (previous.hasOwnProperty(k)) {
            values[k] = previous[k];
          }
        });
      }
    });
    return labelsWithValues;
  }

  onLabelsFiltersChanged = (label: L.LabelName, value: string, checked: boolean) => {
    let newLabels = new Map();
    this.state.labelValues.forEach((val, key) => {
      let newVal = assign(val)({});
      if (key === label) {
        newVal[value] = checked;
      }
      newLabels.set(key, newVal);
    });

    this.setState({ labelValues: newLabels });
  };

  render() {
    if (!this.props.isPageVisible) {
      return null;
    }

    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand');
    urlParams.delete('expand');
    const notExpandedLink = history.location.pathname + '?' + urlParams.toString();

    return (
      <div>
        {expandedChart && (
          <h3 className={expandedChartBackLinkStyle}>
            <Link to={notExpandedLink}>
              <Icon name="angle-double-left" /> View all metrics
            </Link>
          </h3>
        )}
        <MetricsOptionsBar
          onOptionsChanged={this.onOptionsChanged}
          onReporterChanged={console.log} // TODO: make reporter optional
          onRefresh={this.fetchMetrics}
          onLabelsFiltersChanged={this.onLabelsFiltersChanged}
          metricReporter={'source'} // TODO: make reporter optional
          direction={M.MetricsDirection.INBOUND} // TODO: get rid of direction
          labelValues={this.state.labelValues}
        />
        {expandedChart ? this.renderExpandedChart(expandedChart) : this.renderMetrics()}
      </div>
    );
  }

  renderMetrics() {
    const charts = this.state.chartDefs;
    return (
      <div className="card-pf">
        <div className="row row-cards-pf">
          <div className="col-xs-12">
            <div className="card-pf-accented card-pf-aggregate-status">
              <div className="card-pf-body">
                {this.state.chartDefs && this.state.chartDefs.charts.map(c => this.renderChart(c))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderExpandedChart(chartKey: string) {
    if (this.state.chartDefs) {
      const chart = this.state.chartDefs.charts.find(c => c.name === chartKey);
      if (chart) {
        return <div className={expandedChartContainerStyle}>{this.renderChart(chart)}</div>;
      }
    }
    return undefined;
  }

  private convertAsPromLabels(
    chartLabels: M.Aggregation[],
    labels: Map<L.LabelName, L.LabelValues>
  ): Map<L.PromLabel, L.LabelValues> {
    const promLabels = new Map<L.PromLabel, L.LabelValues>();
    labels.forEach((val, k) => {
      const chartLabel = chartLabels.find(l => l.displayName === k);
      if (chartLabel) {
        promLabels.set(chartLabel.label, val);
      }
    });
    return promLabels;
  }

  private renderChart(chart: M.Chart) {
    if (chart.counterRate) {
      return (
        <MetricChart
          key={chart.name}
          chartName={chart.name}
          labelValues={this.convertAsPromLabels(chart.aggregations, this.state.labelValues)}
          unit={chart.unit}
          series={chart.counterRate.matrix}
          onExpandRequested={() => this.onExpandHandler(chart.name)}
        />
      );
    } else if (chart.histogram) {
      return (
        <HistogramChart
          key={chart.name}
          chartName={chart.name}
          labelValues={this.convertAsPromLabels(chart.aggregations, this.state.labelValues)}
          unit={chart.unit}
          histogram={chart.histogram}
          onExpandRequested={() => this.onExpandHandler(chart.name)}
        />
      );
    }
    return undefined;
  }

  private onExpandHandler = (chartKey: string): void => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set('expand', chartKey);
    history.push(history.location.pathname + '?' + urlParams.toString());
  };

  private extractLabelValuesOnSeries(
    series: M.TimeSeries[],
    labels: M.Aggregation[],
    extracted: Map<L.LabelName, L.LabelValues>
  ): void {
    series.forEach(ts => {
      Object.keys(ts.metric).forEach(k => {
        const label = labels.find(l => l.label === k);
        if (label) {
          const value = ts.metric[k];
          let values = extracted.get(label.displayName as L.LabelName);
          if (!values) {
            values = {};
            extracted.set(label.displayName as L.LabelName, values);
          }
          values[value] = true;
        }
      });
    });
  }
}
