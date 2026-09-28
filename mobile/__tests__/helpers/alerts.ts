import { Alert, type AlertButton } from 'react-native';

export interface ShownAlert {
  title: string;
  message: string | undefined;
  buttons: AlertButton[];
}

export type AlertChoice = 'confirm' | 'cancel';

/**
 * Replaces the native Alert with a recorder that immediately presses one button: the first
 * non-cancel button ("confirm") or the `style: 'cancel'` one. Change the choice mid-test with
 * `choose()`. Every dialog shown is kept in `shown`, in order.
 */
export function mockAlerts(initial: AlertChoice = 'confirm') {
  let choice = initial;
  const shown: ShownAlert[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons = []) => {
    shown.push({ title, message, buttons });
    const button =
      choice === 'cancel'
        ? buttons.find((b) => b.style === 'cancel')
        : buttons.find((b) => b.style !== 'cancel');
    button?.onPress?.();
  });
  return {
    shown,
    choose(next: AlertChoice) {
      choice = next;
    },
  };
}
