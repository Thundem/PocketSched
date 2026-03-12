import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { getLessonsByDay, clearLessonsByDay } from '../db/database';
import { getHiddenSubgroup } from '../services/settings';
import { TimeEngine } from '../services/timeEngine';
import { Ionicons } from '@expo/vector-icons';

const timeEngine = new TimeEngine();

export default function DayScheduleScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const isTomorrow = route.name === 'Tomorrow';

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string>('');

  const getTargetDayOfWeek = () => {
    let date = new Date();
    if (isTomorrow) {
      date.setDate(date.getDate() + 1);
    }
    let day = date.getDay();
    return day === 0 ? 7 : day; // Неділя як 7
  };

  const targetDayOfWeek = getTargetDayOfWeek();

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
      const dateStr = `${String(targetDate.getDate()).padStart(2, '0')}.${String(targetDate.getMonth() + 1).padStart(2, '0')}.${targetDate.getFullYear()}`;
      const raw = await getLessonsByDay(targetDayOfWeek, dateStr);
      const fetchedLessons = raw
        .filter(l => l.exam_date || l.week_type === 'ALL' || l.week_type === weekFilter)
        .filter(l => !hiddenSub || l.subgroup !== hiddenSub);
      setLessons(fetchedLessons);
      updateActiveLesson(fetchedLessons);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
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
      <FlatList
        data={lessons}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <LessonCard
            lesson={item}
            isActive={item.id === activeLessonId}
            onDeleteSuccess={fetchLessons}
          />
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