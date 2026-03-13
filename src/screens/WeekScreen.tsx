import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson, WeekType } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { updateSortOrders } from '../db/database';
import { TimeEngine } from '../services/timeEngine';
import { useScheduleStore } from '../stores/ScheduleContext';

const DAYS_OF_WEEK = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];
const timeEngine = new TimeEngine();

export default function WeekScreen() {
  const route = useRoute();
  const isNextWeek = route.name === 'NextWeek';
  const { lessons: allLessons, overrides, hiddenSubgroup, isReady, refresh } = useScheduleStore();

  const currentWeekType = timeEngine.getCurrentWeekType();
  const weekFilter: WeekType = isNextWeek
    ? (currentWeekType === 'NUMERATOR' ? 'DENOMINATOR' : 'NUMERATOR')
    : currentWeekType;
  const weekLabel = weekFilter === 'NUMERATOR' ? 'Чисельник (непарний)' : 'Знаменник (парний)';

  // Week dates for current or next week
  const weekDates = useMemo(() => {
    const today = new Date();
    const dow = today.getDay() === 0 ? 7 : today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (dow - 1) + (isNextWeek ? 7 : 0));
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return fmt(d);
    });
  }, [isNextWeek]);

  // Pure in-memory filter — instant, no DB calls
  const sections = useMemo(() => {
    if (!isReady) return [];

    // Only consider overrides whose original date falls within this week
    const weekOverrides = overrides.filter(o => weekDates.includes(o.original_date));
    const movedAwayIds = new Set(weekOverrides.map(o => o.lesson_id));
    const movedHereByDay = new Map<number, typeof weekOverrides[number][]>();
    weekOverrides.forEach(o => {
      if (!movedHereByDay.has(o.new_day_of_week)) movedHereByDay.set(o.new_day_of_week, []);
      movedHereByDay.get(o.new_day_of_week)!.push(o);
    });

    const regularLessons = allLessons
      .filter(l => !l.exam_date && !movedAwayIds.has(l.id))
      .filter(l => l.week_type === 'ALL' || l.week_type === weekFilter)
      .filter(l => !hiddenSubgroup || l.subgroup !== hiddenSubgroup);

    const exams = allLessons
      .filter(l => l.exam_date && weekDates.includes(l.exam_date!) && !movedAwayIds.has(l.id))
      .filter(l => !hiddenSubgroup || l.subgroup !== hiddenSubgroup);

    return DAYS_OF_WEEK.map((dayName, index) => {
      const dayNum = index + 1;
      const dayExams = exams.filter(l => l.exam_date === weekDates[index]);
      const dayLessons = regularLessons.filter(l => l.day_of_week === dayNum);
      const movedHereOvs = movedHereByDay.get(dayNum) || [];
      const movedHereIds = movedHereOvs.map(o => o.lesson_id);
      const dayMoved = allLessons
        .filter(l => movedHereIds.includes(l.id) && !l.exam_date && (!hiddenSubgroup || l.subgroup !== hiddenSubgroup))
        .map(l => {
          const ov = movedHereOvs.find(o => o.lesson_id === l.id);
          if (!ov) return l;
          return { ...l, start_time: ov.new_start_time ?? l.start_time, end_time: ov.new_end_time ?? l.end_time };
        });
      const all = [...dayLessons, ...dayMoved, ...dayExams];
      all.sort((a, b) => {
        const sa = a.sort_order ?? Infinity, sb = b.sort_order ?? Infinity;
        return sa !== sb ? sa - sb : a.start_time.localeCompare(b.start_time);
      });
      return { title: dayName, data: all };
    }).filter(g => g.data.length > 0);
  }, [allLessons, overrides, hiddenSubgroup, isReady, weekFilter, weekDates]);

  const handleMoveInSection = useCallback(async (dayData: Lesson[], fromIdx: number, toIdx: number) => {
    const newList = [...dayData];
    [newList[fromIdx], newList[toIdx]] = [newList[toIdx], newList[fromIdx]];
    const updates = newList.map((l, i) => ({ id: l.id, sort_order: i * 10 }));
    await updateSortOrders(updates);
    await refresh();
  }, [refresh]);

  if (!isReady) {
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
        renderItem={({ item, index, section }) => {
          const dayIdx = DAYS_OF_WEEK.indexOf(section.title);
          const displayDate = weekDates[dayIdx] ?? '';
          return (
            <LessonCard
              lesson={item}
              onDeleteSuccess={refresh}
              displayDate={displayDate}
              onMoveUp={index > 0 ? () => handleMoveInSection(section.data, index, index - 1) : undefined}
              onMoveDown={index < section.data.length - 1 ? () => handleMoveInSection(section.data, index, index + 1) : undefined}
            />
          );
        }}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Розклад на тиждень порожній</Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
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