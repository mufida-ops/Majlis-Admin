import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';

export interface AlertButtonSpec {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons: AlertButtonSpec[];
}

let setCurrent: ((config: AlertConfig | null) => void) | null = null;

/**
 * A self-contained in-app confirm/alert dialog (rendered via <AlertHost/>,
 * mounted once at the root) — NOT the native browser confirm()/alert(),
 * and NOT React Native's Alert.alert either. Neither of those actually
 * works here: react-native-web doesn't implement Alert.alert at all, and
 * once the app is added to the iOS home screen (standalone display mode,
 * no Safari chrome), window.confirm/window.alert are suppressed by iOS
 * with no dialog and no error — silently doing nothing either way. This
 * draws its own modal, so it works identically in the native app, in a
 * browser tab, and installed to the home screen.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButtonSpec[]): void {
  const resolved = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  setCurrent?.({ title, message, buttons: resolved });
}

export function AlertHost() {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    setCurrent = setConfig;
    return () => {
      setCurrent = null;
    };
  }, []);

  const close = useCallback(() => setConfig(null), []);

  function press(button: AlertButtonSpec) {
    close();
    button.onPress?.();
  }

  if (!config) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{config.title}</Text>
          {!!config.message && <Text style={styles.message}>{config.message}</Text>}
          <View style={styles.buttons}>
            {config.buttons.map((b, i) => (
              <Pressable key={i} style={styles.button} onPress={() => press(b)} hitSlop={8}>
                <Text style={[styles.buttonText, b.style === 'cancel' && styles.cancelText, b.style === 'destructive' && styles.destructiveText]}>
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  message: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xl, marginTop: spacing.xs },
  button: { paddingVertical: 6 },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  cancelText: { color: colors.textSecondary },
  destructiveText: { color: colors.danger }
});
