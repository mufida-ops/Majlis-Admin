import { Alert, Platform } from 'react-native';

export interface AlertButtonSpec {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

/**
 * react-native-web has no real implementation of RN's Alert.alert — on the
 * GitHub Pages / browser build it silently no-ops, so every confirm-before-
 * delete dialog and error message in this app must go through this wrapper
 * instead of calling Alert.alert directly (native still uses the real
 * native alert; only web falls back to window.confirm/window.alert).
 */
export function showAlert(title: string, message?: string, buttons?: AlertButtonSpec[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  if (!buttons || buttons.length <= 1) {
    window.alert(message ? `${title}\n\n${message}` : title);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const actionButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  const confirmed = window.confirm(message ? `${title}\n\n${message}` : title);
  if (confirmed) {
    actionButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
