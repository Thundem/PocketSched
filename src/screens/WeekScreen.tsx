import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson, WeekType } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { getAllLessons } from '../db/database';
import { getHiddenSubgroup } from '../services/settings';
import { TimeEngine } from '../services/timeEngine';

const DAYS_OF_WEEK = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];
const timeEngine = new TimeEngine();

export default function WeekScreen() {
  const route = useRoute();
  const isNextWeek = route.name === 'NextWeek';
  const currentWeekType = timeEngine.getCurrentWeekType();
  const weekFilter: WeekType = isNextWeek
    ? (currentWeekType === 'NUMERATOR' ? 'DENOMINATOR' : 'NUMERATOR')
    : currentWeekType;
  const weekLabel = weekFilter === 'NUMERATOR' ? 'Чисельник (непарний)' : 'Знаменник (парний)';

  const [sections, setSections] = useState<{title: string, data: Lesson[]}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWeekLessons = async () => {
    setIsLoading(true);
    try {
      const hiddenSub = await getHiddenSubgroup();
      const rawLessons = await getAllLessons();
      const allLessons = rawLessons
        .filter(l => l.week_type === 'ALL' || l.week_type === weekFilter)
        .filter(l => !hiddenSub || l.subgroup !== hiddenSub);
      
      // Групуємо уроки по днях тижня
      const groups = DAYS_OF_WEEK.map((dayName, index) => {
        const dayNum = index + 1;
        return {
          title: dayName,
          data: allLessons.filter(l => l.day_of_week === dayNum)
        };
      }).filter(group => group.data.length > 0); // Показуємо тільки дні, де є пари

      setSections(groups);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWeekLessons();
    }, [])
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Розклад на тиждень порожній</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.weekBanner}>
        <Text style={styles.weekBannerText}>{weekLabel}</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <LessonCard 
            lesson={item} 
            onDeleteSuccess={fetchWeekLessons} 
          />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: colors.inactive,
    fontSize: 18,
    fontWeight: '500',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  headerText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  weekBanner: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    alignItems: 'center',
  },
  weekBannerText: {
    color: colors.inactive,
    fontSize: 13,
    fontWeight: '500',
  },
});