import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SwitchRow } from '@/components/SwitchRow';
import { MIN_TOUCH_TARGET, hitSlopTo } from '@/core/theme/tokens';

describe('SwitchRow (Phase 10 accessibility)', () => {
  it('is one switch item for TalkBack: label, role, checked state; the row toggles', async () => {
    const onValueChange = jest.fn();
    await render(
      <SwitchRow
        testID="s"
        label="Let people find me"
        value={false}
        onValueChange={onValueChange}
      />,
    );
    const row = screen.getByTestId('s-row');
    expect(row.props.accessibilityRole).toBe('switch');
    expect(row.props.accessibilityLabel).toBe('Let people find me');
    expect(row.props.accessibilityState).toMatchObject({ checked: false });
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(MIN_TOUCH_TARGET);
    // The inner Switch does not become a second TalkBack stop.
    expect(screen.getByTestId('s').props.importantForAccessibility).toBe('no');

    await fireEvent.press(row);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});

describe('hitSlopTo', () => {
  it('grows a control to the 48 dp minimum and never shrinks one', () => {
    expect(40 + 2 * hitSlopTo(40)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(30 + 2 * hitSlopTo(30)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(hitSlopTo(56)).toBe(0);
  });
});
