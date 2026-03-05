import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function SettingsScreen() {
  const [isNumerator, setIsNumerator] = React.useState(true); // Для початку статично

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Налаштування</Text>
      
      <View style={styles.settingRow}>
        <View>
          <Text style={styles.settingTitle}>Примусовий тиждень</Text>
          <Text style={styles.settingDesc}>
            Поточний: {isNumerator ? 'Чисельник (Непарний)' : 'Знаменник (Парний)'}
          </Text>
        </View>
        <Switch 
          value={isNumerator} 
          onValueChange={setIsNumerator} 
          trackColor={{ false: colors.inactive, true: colors.primaryVariant }}
          thumbColor={isNumerator ? colors.primary : colors.surface}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    color: colors.onBackground,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  settingTitle: {
    color: colors.onSurface,
    fontSize: 18,
  },
  settingDesc: {
    color: colors.inactive,
    fontSize: 14,
    marginTop: 4,
  }
});
