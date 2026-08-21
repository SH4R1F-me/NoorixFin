import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Radius, Spacing, Typography } from '../lib/theme';

export function Screen({
  title,
  children,
  scroll = true,
  actions,
}: PropsWithChildren<{ title: string; scroll?: boolean; actions?: ReactNode }>) {
  const router = useRouter();
  const { t } = useTranslation();
  const content = (
    <>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mobile.management.back')}
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={24} color={Colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <View style={styles.actionSlot}>{actions}</View>
      </View>
      {scroll ? <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView> : children}
    </>
  );
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>{content}</SafeAreaView>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field} accessibilityRole="radiogroup">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: option === value }}
            onPress={() => onChange(option)}
            style={[styles.choice, option === value && styles.choiceSelected]}
          >
            <Text style={[styles.choiceText, option === value && styles.choiceTextSelected]}>
              {option.replaceAll('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Button({
  label,
  onPress,
  busy = false,
  destructive = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.buttonDanger,
        (disabled || busy) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Empty({ children }: PropsWithChildren) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return (
    <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.notice, error && styles.error]}>
      {children}
    </Text>
  );
}

export const primitiveStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  cardTitle: { ...Typography.body, fontWeight: '700' },
  secondary: { ...Typography.caption, marginTop: 3 },
  section: { ...Typography.label, marginTop: Spacing.md },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3, flex: 1, textAlign: 'center' },
  actionSlot: { width: 48, alignItems: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  field: { gap: Spacing.xs },
  label: { ...Typography.label },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  choice: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
  },
  choiceSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  choiceText: { ...Typography.bodyDim, fontWeight: '600', textTransform: 'capitalize' },
  choiceTextSelected: { color: '#000' },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  buttonDanger: { backgroundColor: Colors.error },
  buttonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  empty: { ...Typography.bodyDim, textAlign: 'center', paddingVertical: Spacing.xl },
  notice: { ...Typography.bodyDim },
  error: { color: Colors.error },
});
