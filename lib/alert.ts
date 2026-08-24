import { Alert, Platform } from 'react-native';

type AlertButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

// react-native-web's Alert.alert is a total no-op ("static alert() {}") — so
// every confirm-before-delete and every error message in this app silently
// did nothing when tapped on the web build, with no visible failure at all
// (the delete button, the flag button, every Alert-based confirmation).
// Same signature as Alert.alert so every call site is a drop-in swap; on web
// it falls back to real browser dialogs (window.confirm/alert) instead.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actionable = (buttons ?? []).filter(b => b.style !== 'cancel');
  if (actionable.length === 0) {
    window.alert(text);
    return;
  }
  if (window.confirm(text)) {
    actionable[0].onPress?.();
  }
}
