import * as React from 'react';
import { Breadcrumb, Card, CardBody, CardGrid, CardTitle, Col, Row } from 'patternfly-react';
import { style } from 'typestyle';
import { AxiosError } from 'axios';
import _ from 'lodash';

import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import * as API from '../../services/Api';
import {
  DEGRADED,
  FAILURE,
  Health,
  HEALTHY,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth
} from '../../types/Health';
import { SortField } from '../../types/SortFilters';
import { PromisesRegistry } from '../../utils/CancelablePromises';

import { FiltersAndSorts } from './FiltersAndSorts';
import OverviewToolbarContainer, { OverviewToolbar, OverviewType, OverviewDisplayMode } from './OverviewToolbar';
import NamespaceInfo, { NamespaceStatus } from './NamespaceInfo';
import OverviewCardContent from './OverviewCardContent';
import { summarizeHealthFilters, switchType } from './OverviewHelper';
import { default as NamespaceMTLSStatusContainer } from '../../components/MTls/NamespaceMTLSStatus';
import OverviewCardContentExpanded from './OverviewCardContentExpanded';
import { MetricsOptions } from '../../types/MetricsOptions';
import { computePrometheusRateParams } from '../../services/Prometheus';
import OverviewCardLinks from './OverviewCardLinks';

type State = {
  namespaces: NamespaceInfo[];
  type: OverviewType;
  displayMode: OverviewDisplayMode;
};

const cardGridStyle = style({ width: '100%' });

class OverviewPage extends React.Component<{}, State> {
  private promises = new PromisesRegistry();
  private displayModeSet = false;

  constructor(props: {}) {
    super(props);
    this.state = {
      namespaces: [],
      type: OverviewToolbar.currentOverviewType(),
      displayMode: OverviewDisplayMode.EXPAND
    };
  }

  componentDidMount() {
    this.load();
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  sortFields() {
    return FiltersAndSorts.sortFields;
  }

  load = () => {
    this.promises.cancelAll();
    this.promises
      .register('namespaces', API.getNamespaces())
      .then(namespacesResponse => {
        const nameFilters = FilterSelected.getSelected().filter(f => f.category === FiltersAndSorts.nameFilter.title);
        const allNamespaces: NamespaceInfo[] = namespacesResponse['data']
          .filter(ns => {
            return nameFilters.length === 0 || nameFilters.some(f => ns.name.includes(f.value));
          })
          .map(ns => {
            const previous = this.state.namespaces.find(prev => prev.name === ns.name);
            return {
              name: ns.name,
              status: previous ? previous.status : undefined,
              tlsStatus: previous ? previous.tlsStatus : undefined,
              metrics: previous ? previous.metrics : undefined
            };
          });
        const isAscending = ListPagesHelper.isCurrentSortAscending();
        const sortField = ListPagesHelper.currentSortField(FiltersAndSorts.sortFields);
        const type = OverviewToolbar.currentOverviewType();
        const displayMode = this.displayModeSet
          ? this.state.displayMode
          : allNamespaces.length > 16
          ? OverviewDisplayMode.COMPACT
          : OverviewDisplayMode.EXPAND;
        // Set state before actually fetching health
        this.setState(
          {
            type: type,
            namespaces: FiltersAndSorts.sortFunc(allNamespaces, sortField, isAscending),
            displayMode: displayMode
          },
          () => {
            this.fetchHealth(isAscending, sortField, type);
            this.fetchTLS(isAscending, sortField);
            if (displayMode === OverviewDisplayMode.EXPAND) {
              this.fetchMetrics();
            }
          }
        );
      })
      .catch(namespacesError => this.handleAxiosError('Could not fetch namespace list', namespacesError));
  };

  fetchHealth(isAscending: boolean, sortField: SortField<NamespaceInfo>, type: OverviewType) {
    const duration = ListPagesHelper.currentDuration();
    // debounce async for back-pressure, ten by ten
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('healthchunks', undefined, () => this.fetchHealthChunk(chunk, duration, type))
        .then(() => {
          this.setState(prevState => {
            let newNamespaces = prevState.namespaces.slice();
            if (sortField.id === 'health') {
              newNamespaces = FiltersAndSorts.sortFunc(newNamespaces, sortField, isAscending);
            }
            return { namespaces: newNamespaces };
          });
        });
    });
  }

  fetchHealthChunk(chunk: NamespaceInfo[], duration: number, type: OverviewType) {
    const apiFunc = switchType(
      type,
      API.getNamespaceAppHealth,
      API.getNamespaceServiceHealth,
      API.getNamespaceWorkloadHealth
    );
    return Promise.all(
      chunk.map(nsInfo => {
        const healthPromise: Promise<NamespaceAppHealth | NamespaceWorkloadHealth | NamespaceServiceHealth> = apiFunc(
          nsInfo.name,
          duration
        );
        return healthPromise.then(rs => ({ health: rs, nsInfo: nsInfo }));
      })
    )
      .then(results => {
        results.forEach(result => {
          const nsStatus: NamespaceStatus = {
            inError: [],
            inWarning: [],
            inSuccess: [],
            notAvailable: []
          };
          Object.keys(result.health).forEach(item => {
            const health: Health = result.health[item];
            const status = health.getGlobalStatus();
            if (status === FAILURE) {
              nsStatus.inError.push(item);
            } else if (status === DEGRADED) {
              nsStatus.inWarning.push(item);
            } else if (status === HEALTHY) {
              nsStatus.inSuccess.push(item);
            } else {
              nsStatus.notAvailable.push(item);
            }
          });
          result.nsInfo.status = nsStatus;
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch health', err));
  }

  fetchMetrics() {
    const duration = ListPagesHelper.currentDuration();
    // debounce async for back-pressure, ten by ten
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('metricschunks', undefined, () => this.fetchMetricsChunk(chunk, duration))
        .then(() => {
          this.setState(prevState => {
            return { namespaces: prevState.namespaces.slice() };
          });
        });
    });
  }

  fetchMetricsChunk(chunk: NamespaceInfo[], duration: number) {
    const rateParams = computePrometheusRateParams(duration, 10);
    const optionsIn: MetricsOptions = {
      filters: ['request_count'],
      duration: duration,
      step: rateParams.step,
      rateInterval: rateParams.rateInterval,
      direction: 'inbound',
      reporter: 'destination'
    };
    return Promise.all(
      chunk.map(nsInfo => {
        return API.getNamespaceMetrics(nsInfo.name, optionsIn).then(rs => {
          nsInfo.metrics = undefined;
          if (rs.data.metrics.hasOwnProperty('request_count')) {
            nsInfo.metrics = rs.data.metrics['request_count'].matrix;
          }
          return nsInfo;
        });
      })
    ).catch(err => this.handleAxiosError('Could not fetch health', err));
  }

  fetchTLS(isAscending: boolean, sortField: SortField<NamespaceInfo>) {
    _.chunk(this.state.namespaces, 10).forEach(chunk => {
      this.promises
        .registerChained('tlschunks', undefined, () => this.fetchTLSChunk(chunk))
        .then(() => {
          this.setState(prevState => {
            let newNamespaces = prevState.namespaces.slice();
            if (sortField.id === 'tls') {
              newNamespaces = FiltersAndSorts.sortFunc(newNamespaces, sortField, isAscending);
            }
            return { namespaces: newNamespaces };
          });
        });
    });
  }

  fetchTLSChunk(chunk: NamespaceInfo[]) {
    return Promise.all(
      chunk.map(nsInfo => {
        return API.getNamespaceTls(nsInfo.name).then(rs => ({ status: rs.data, nsInfo: nsInfo }));
      })
    )
      .then(results => {
        results.forEach(result => {
          result.nsInfo.tlsStatus = result.status;
        });
      })
      .catch(err => this.handleAxiosError('Could not fetch TLS status', err));
  }

  handleAxiosError(message: string, error: AxiosError) {
    ListPagesHelper.handleError(API.getErrorMsg(message, error));
  }

  sort = (sortField: SortField<NamespaceInfo>, isAscending: boolean) => {
    const sorted = FiltersAndSorts.sortFunc(this.state.namespaces, sortField, isAscending);
    this.setState({ namespaces: sorted });
  };

  setDisplayMode = (mode: OverviewDisplayMode) => {
    this.displayModeSet = true;
    this.setState({ displayMode: mode });
    if (mode === OverviewDisplayMode.EXPAND) {
      // Load metrics
      this.fetchMetrics();
    }
  };

  render() {
    const { showInError, showInWarning, showInSuccess, noFilter } = summarizeHealthFilters();
    const [xs, sm, md] = this.state.displayMode === OverviewDisplayMode.COMPACT ? [6, 3, 3] : [12, 6, 4];
    return (
      <>
        <Breadcrumb title={true}>
          <Breadcrumb.Item active={true}>Namespaces</Breadcrumb.Item>
        </Breadcrumb>
        <OverviewToolbarContainer
          onRefresh={this.load}
          onError={ListPagesHelper.handleError}
          sort={this.sort}
          displayMode={this.state.displayMode}
          setDisplayMode={this.setDisplayMode}
        />
        <div className="cards-pf">
          <CardGrid matchHeight={true} className={cardGridStyle}>
            <Row style={{ marginBottom: '20px', marginTop: '20px' }}>
              {this.state.namespaces
                .filter(ns => {
                  return (
                    noFilter ||
                    (ns.status &&
                      ((showInError && ns.status.inError.length > 0) ||
                        (showInWarning && ns.status.inWarning.length > 0) ||
                        (showInSuccess && ns.status.inSuccess.length > 0)))
                  );
                })
                .map(ns => {
                  return (
                    <Col xs={xs} sm={sm} md={md} key={ns.name}>
                      <Card matchHeight={true} accented={true} aggregated={true}>
                        <CardTitle>
                          {ns.tlsStatus ? <NamespaceMTLSStatusContainer status={ns.tlsStatus.status} /> : undefined}
                          {ns.name}
                        </CardTitle>
                        <CardBody>
                          {this.renderStatuses(ns)}
                          <OverviewCardLinks name={ns.name} />
                        </CardBody>
                      </Card>
                    </Col>
                  );
                })}
            </Row>
          </CardGrid>
        </div>
      </>
    );
  }

  renderStatuses(ns: NamespaceInfo): JSX.Element {
    if (ns.status) {
      if (this.state.displayMode === OverviewDisplayMode.COMPACT) {
        return <OverviewCardContent key={ns.name} name={ns.name} status={ns.status} type={this.state.type} />;
      }
      return (
        <OverviewCardContentExpanded
          key={ns.name}
          name={ns.name}
          duration={ListPagesHelper.currentDuration()}
          status={ns.status}
          type={this.state.type}
          metrics={ns.metrics}
        />
      );
    }
    return <div style={{ height: 70 }} />;
  }
}

export default OverviewPage;
