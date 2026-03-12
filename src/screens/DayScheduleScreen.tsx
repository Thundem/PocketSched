import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { clearLessonsByDay, getAllLessons, getOverridesForWeek, updateSortOrders } from '../db/database';
import { getHiddenSubgroup } from '../services/settings';
import { TimeEngine } from '../services/timeEngine';
import { Ionicons } from '@expo/vector-icons';

const timeEngine = new TimeEngine();

function getWeekDates(baseDate = new Date()): string[] {
  const dow = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (dow - 1));
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  return Array.from({length: 7}, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return fmt(d); });
}

export default function DayScheduleScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const isTomorrow = route.name === 'Tomorrow';

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string>('');
  const [isReordering, setIsReordering] = useState(false);

  const getTargetDayOfWeek = () => {
    let date = new Date();
    if (isTomorrow) {
      date.setDate(date.getDate() + 1);
    }
    let day = date.getDay();
    return day === 0 ? 7 : day; // Неділя як 7
  };

  const targetDayOfWeek = getTargetDayOfWeek();
  const _targetDateObj = (() => { const d = new Date(); if (isTomorrow) d.setDate(d.getDate() + 1); return d; })();
  const dateStr = `${String(_targetDateObj.getDate()).padStart(2,'0')}.${String(_targetDateObj.getMonth()+1).padStart(2,'0')}.${_targetDateObj.getFullYear()}`;

  const updateActiveLesson = useCallback((currentLessons: Lesson[]) => {
    if (isTomorrow) {
      setActiveLessonId('');
      return;
    }
    const active = timeEngine.getActiveLesson(currentLessons);
    setActiveLessonId(active ? active.id : '');
  }, [isTomorrow]);

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const hiddenSub = await getHiddenSubgroup();
      const targetDate = new Date();
      if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1);
      const weekFilter = timeEngine.getCurrentWeekType(targetDate);
      const allLessons = await getAllLessons();
      const overrides = await getOverridesForWeek(getWeekDates(targetDate));
      const movedAwayIds = new Set(overrides.filter(o => o.original_date === dateStr).map(o => o.lesson_id));
      const movedHereMap = new Map(overrides.filter(o => o.new_day_of_week === targetDayOfWeek).map(o => [o.lesson_id, o]));
      const fetchedLessons = allLessons.filter(l => {
        if (movedAwayIds.has(l.id)) return false;
        if (l.exam_date) return l.exam_date === dateStr;
        if (movedHereMap.has(l.id)) return !hiddenSub || l.subgroup !== hiddenSub;
        return l.day_of_week === targetDayOfWeek &&
          (l.week_type === 'ALL' || l.week_type === weekFilter) &&
          (!hiddenSub || l.subgroup !== hiddenSub);
      }).map(l => {
        const ov = movedHereMap.get(l.id);
        if (!ov) return l;
        return { ...l, start_time: ov.new_start_time ?? l.start_time, end_time: ov.new_end_time ?? l.end_time };
      });
      fetchedLessons.sort((a, b) => {
        const sa = a.sort_order ?? Infinity, sb = b.sort_order ?? Infinity;
        return sa !== sb ? sa - sb : a.start_time.localeCompare(b.start_time);
      });
      setLessons(fetchedLessons);
      updateActiveLesson(fetchedLessons);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async ({ data }: { data: Lesson[] }) => {
    setIsReordering(false);
    const updates = data.map((l, i) => ({ id: l.id, sort_order: i * 10 }));
    await updateSortOrders(updates);
    setLessons(data.map((l, i) => ({ ...l, sort_order: i * 10 })));
  };

  useFocusEffect(
    useCallback(() => {
      fetchLessons();
    }, [targetDayOfWeek])
  );

  // Оновлюємо статус активної пари кожну хвилину, якщо це "Сьогодні"
  useEffect(() => {
    if (!isTomorrow && lessons.length > 0) {
      updateActiveLesson(lessons); // перевіряємо одразу

      const intervalId = setInterval(() => {
        updateActiveLesson(lessons);
      }, 60000); // 1 хвилина

      return () => clearInterval(intervalId);
    }
  }, [lessons, isTomorrow, updateActiveLesson]);

  const handleScanSchedule = async () => {
    // Перенесено у хедер RootNavigator — доступно з будь-якої вкладки
  };

  const handleClearDay = () => {
    Alert.alert(
      'Видалити всі пари?',
      'Ви впевнені, що хочете видалити всі пари на цей день?',
      [
        { text: 'Скасувати', style: 'cancel' },
        { 
          text: 'Видалити', 
          style: 'destructive',
          onPress: async () => {
            await clearLessonsByDay(targetDayOfWeek);
            fetchLessons();
          }
        }
      ]
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        lessons.length > 0 ? (
          <TouchableOpacity style={{ marginRight: 16, padding: 4 }} onPress={handleClearDay}>
            <Ionicons name="trash-outline" size={22} color="#ff4d4d" />
          </TouchableOpacity>
        ) : undefined,
    });
  }, [navigation, lessons.length]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{isTomorrow ? 'Завтра пар немає 🎉' : 'Сьогодні пар немає 🎉'}</Text>
      {!isTomorrow && (
        <Text style={styles.emptyHint}>Натисніть іконку камери вгорі, щоб відсканувати розклад</Text>
      )}
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
      <DraggableFlatList
        data={lessons}
        keyExtractor={(item: Lesson) => item.id}
        showsVerticalScrollIndicator={false}
        activationDistance={10}
        onDragEnd={handleDragEnd}
        renderItem={({ item, drag }: RenderItemParams<Lesson>) => (
          <ScaleDecorator>
            <LessonCard
              lesson={item}
              isActive={item.id === activeLessonId}
              isReordering={isReordering}
              drag={drag}
              onDeleteSuccess={fetchLessons}
              displayDate={dateStr}
            />
          </ScaleDecorator>
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
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
  emptyHint: {
    color: colors.inactive,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});