import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson, WeekType } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { getAllLessons, getOverridesForWeek, updateSortOrders } from '../db/database';
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
  const [sectionWeekDates, setSectionWeekDates] = useState<string[]>([]);

  const fetchWeekLessons = async () => {
    setIsLoading(true);
    try {
      const hiddenSub = await getHiddenSubgroup();
      const rawLessons = await getAllLessons();

      // Дати поточного/наступного тижня (Пн–Нд)
      const today = new Date();
      const dow = today.getDay() === 0 ? 7 : today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (dow - 1) + (isNextWeek ? 7 : 0));
      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return fmt(d);
      });
      setSectionWeekDates(weekDates);

      // Одноразові переноси
      const overrides = await getOverridesForWeek(weekDates);
      const movedAwayIds = new Set(overrides.map(o => o.lesson_id));
      const movedHereByDay = new Map<number, typeof overrides[number][]>();
      overrides.forEach(o => {
        if (!movedHereByDay.has(o.new_day_of_week)) movedHereByDay.set(o.new_day_of_week, []);
        movedHereByDay.get(o.new_day_of_week)!.push(o);
      });

      const regularLessons = rawLessons
        .filter(l => !l.exam_date && !movedAwayIds.has(l.id))
        .filter(l => l.week_type === 'ALL' || l.week_type === weekFilter)
        .filter(l => !hiddenSub || l.subgroup !== hiddenSub);

      const exams = rawLessons
        .filter(l => l.exam_date && weekDates.includes(l.exam_date!) && !movedAwayIds.has(l.id))
        .filter(l => !hiddenSub || l.subgroup !== hiddenSub);

      const groups = DAYS_OF_WEEK.map((dayName, index) => {
        const dayNum = index + 1;
        const dayExams = exams.filter(l => l.exam_date === weekDates[index]);
        const dayLessons = regularLessons.filter(l => l.day_of_week === dayNum);
        const movedHereOvs = movedHereByDay.get(dayNum) || [];
        const movedHereIds = movedHereOvs.map(o => o.lesson_id);
        const dayMoved = rawLessons
          .filter(l => movedHereIds.includes(l.id) && !l.exam_date && (!hiddenSub || l.subgroup !== hiddenSub))
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

      setSections(groups);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveInSection = async (dayData: Lesson[], fromIdx: number, toIdx: number) => {
    const newList = [...dayData];
    [newList[fromIdx], newList[toIdx]] = [newList[toIdx], newList[fromIdx]];
    const updates = newList.map((l, i) => ({ id: l.id, sort_order: i * 10 }));
    await updateSortOrders(updates);
    fetchWeekLessons();
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
        renderItem={({ item, index, section }) => {
          const dayIdx = DAYS_OF_WEEK.indexOf(section.title);
          const displayDate = sectionWeekDates[dayIdx] ?? '';
          return (
            <LessonCard
              lesson={item}
              onDeleteSuccess={fetchWeekLessons}
              displayDate={displayDate}
              onMoveUp={index > 0 ? () => handleMoveInSection(section.data, index, index - 1) : undefined}
              onMoveDown={index < section.data.length - 1 ? () => handleMoveInSection(section.data, index, index + 1) : undefined}
            />
          );
        }}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
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