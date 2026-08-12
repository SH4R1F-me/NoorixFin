/**
 * Add tab — placeholder required by Expo Router for tab to register.
 * The actual add-transaction modal is at /add-transaction.
 * This screen is never shown because the tab button triggers the modal.
 */
import { View } from 'react-native';
import { Colors } from '../../src/lib/theme';

export default function AddTab() {
  return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
}
