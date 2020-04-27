import * as React from 'react';
import { ToolbarItem } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { ExternalLink } from '@kiali/k-charted-pf4';

import { MetricsObjectTypes } from '../../types/Metrics';

type Props = {
  links: ExternalLink[];
  namespace: string;
  object: string;
  objectType: MetricsObjectTypes;
  version?: string;
};

export class GrafanaLinks extends React.PureComponent<Props, {}> {
  static buildGrafanaLinks(props: Props): [string, string][] {
    const links: [string, string][] = [];
    props.links.forEach(d => {
      const first = d.url.includes('?') ? '&' : '?';
      const params: string[] = [];
      switch (props.objectType) {
        case MetricsObjectTypes.SERVICE:
          if (d.variables.service) {
            params.push(`${d.variables.service}=${props.object}.${props.namespace}.svc.cluster.local`);
          }
          break;
        case MetricsObjectTypes.WORKLOAD:
          if (d.variables.workload) {
            params.push(`${d.variables.workload}=${props.object}`);
          }
          break;
        case MetricsObjectTypes.APP:
          if (d.variables.app) {
            params.push(`${d.variables.app}=${props.object}`);
          }
          break;
        default:
          break;
      }
      if (d.variables.namespace) {
        params.push(`${d.variables.namespace}=${props.namespace}`);
      }
      if (d.variables.version && props.version) {
        params.push(`${d.variables.version}=${props.version}`);
      }
      const link = d.url + (params.length > 0 ? first + params.join('&') : '');
      links.push([d.name, link]);
    });
    return links;
  }

  render() {
    const links = GrafanaLinks.buildGrafanaLinks(this.props);
    return (
      <>
        {links.length === 1 && (
          <ToolbarItem style={{ borderRight: 'none' }}>
            <a id={'grafana_link_0'} title={links[0][0]} href={links[0][1]} target="_blank" rel="noopener noreferrer">
              View in Grafana <ExternalLinkAltIcon />
            </a>
          </ToolbarItem>
        )}
        {links.length > 1 && (
          <ToolbarItem style={{ borderRight: 'none' }}>
            View in Grafana:&nbsp;
            {links
              .map((link, idx) => (
                <a id={'grafana_link_' + idx} title={link[0]} href={link[1]} target="_blank" rel="noopener noreferrer">
                  {link[0]} <ExternalLinkAltIcon />
                </a>
              ))
              .reduce((prev, curr) => [prev, ', ', curr] as any)}
          </ToolbarItem>
        )}
      </>
    );
  }
}
