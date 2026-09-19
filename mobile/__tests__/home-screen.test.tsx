import { render, screen } from '@testing-library/react-native';

import Index from '../app/index';

describe('Index route', () => {
  it('renders the placeholder shell', async () => {
    await render(<Index />);
    expect(screen.getByTestId('home-screen')).toBeTruthy();
  });
});
