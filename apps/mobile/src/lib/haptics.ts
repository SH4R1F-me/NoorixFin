import * as Haptics from 'expo-haptics';

export function confirmHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function selectionHaptic(): void {
  void Haptics.selectionAsync();
}
