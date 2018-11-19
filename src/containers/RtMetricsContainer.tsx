import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { RtMetrics, RtMetricsProps } from '../components/Metrics/RtMetrics';

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible
});

const RtMetricsContainer = withRouter<RouteComponentProps<{}> & RtMetricsProps>(connect(mapStateToProps)(RtMetrics));

export default RtMetricsContainer;
