import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DirectionalIcon } from '../src/components/DirectionalIcon';
import * as direction from '../src/core/i18n/direction';

jest.mock('../src/core/i18n/direction', () => ({ isLayoutRtl: jest.fn() }));
const isLayoutRtl = direction.isLayoutRtl as jest.Mock;

function transformOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style)?.transform;
}

describe('DirectionalIcon', () => {
  it('is not mirrored in an LTR layout', async () => {
    isLayoutRtl.mockReturnValue(false);
    await render(<DirectionalIcon testID="icon" name="chevron-forward" size={16} />);
    expect(transformOf('icon')).toBeUndefined();
  });

  it('is mirrored horizontally in an RTL layout', async () => {
    isLayoutRtl.mockReturnValue(true);
    await render(<DirectionalIcon testID="icon" name="chevron-forward" size={16} />);
    expect(transformOf('icon')).toEqual([{ scaleX: -1 }]);
  });

  it('keeps caller styles alongside the mirroring', async () => {
    isLayoutRtl.mockReturnValue(true);
    await render(
      <DirectionalIcon testID="icon" name="chevron-forward" size={16} style={{ opacity: 0.5 }} />,
    );
    const style = StyleSheet.flatten(screen.getByTestId('icon').props.style);
    expect(style).toMatchObject({ opacity: 0.5, transform: [{ scaleX: -1 }] });
  });
});
