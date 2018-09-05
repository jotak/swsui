import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfoRoutes from '../ServiceInfoRoutes';

const dependencies = { v1: [{ namespace: 'istio-system', name: 'productpage-v1' }] };

describe('#ServiceInfoRoutes render correctly with data', () => {
  it('should render service routes', () => {
    const wrapper = shallow(<ServiceInfoRoutes dependencies={dependencies} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
