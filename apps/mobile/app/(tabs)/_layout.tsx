/**
 * Tab navigator — §2.4 target navigation.
 *
 * 5 tabs: Home · Transactions · Add(+) · Plan · More
 *
 * The Add (+) tab is a modal trigger, not a real tab — pressing it opens the
 * add-transaction modal rather than a tab screen. This is a common pattern
 * in Expo Router that keeps the modal accessible from anywhere in the app.
 */
import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import {
  Home, ArrowLeftRight, Plus, BarChart3, MoreHorizontal,
} from 'lucide-react-native';
import { Colors } from '../../src/lib/theme';

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.addButton}>
      <View style={styles.addInner}>
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarLabelStyle: styles.tabLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => (
            <ArrowLeftRight size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />

      {/* Fake "Add" tab — pressing it opens the modal */}
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => (
            <AddButton onPress={() => router.push('/add-transaction')} />
          ),
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />

      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MoreHorizontal size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.bgCard,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    paddingTop: 4,
    paddingBottom: 6,
    height: 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -14,
    width: 60,
  },
  addInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
