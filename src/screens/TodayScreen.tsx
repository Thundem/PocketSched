import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { insertLesson, clearAllLessons, getAllLessons, getOverridesForWeek, updateSortOrders } from '../db/database';
import { getHiddenSubgroup } from '../services/settings';
import { TimeEngine } from '../services/timeEngine';
import * as ImagePicker from 'expo-image-picker';
import { processScheduleImage } from '../services/ocrScanner';

const timeEngine = new TimeEngine();

function getWeekDates(baseDate = new Date()): string[] {
  const dow = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (dow - 1));
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  return Array.from({length: 7}, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return fmt(d); });
}

export default function TodayScreen() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string>('');
  const [isReordering, setIsReordering] = useState(false);

  const todayDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const _today = new Date();
  const todayStr = `${String(_today.getDate()).padStart(2,'0')}.${String(_today.getMonth()+1).padStart(2,'0')}.${_today.getFullYear()}`;

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const hiddenSub = await getHiddenSubgroup();
      const weekFilter = timeEngine.getCurrentWeekType(new Date());
      const allLessons = await getAllLessons();
      const overrides = await getOverridesForWeek(getWeekDates(new Date()));
      const movedAwayIds = new Set(overrides.filter(o => o.original_date === todayStr).map(o => o.lesson_id));
      const movedHereMap = new Map(overrides.filter(o => o.new_day_of_week === todayDayOfWeek).map(o => [o.lesson_id, o]));
      const fetchedLessons = allLessons.filter(l => {
        if (movedAwayIds.has(l.id)) return false;
        if (l.exam_date) return l.exam_date === todayStr;
        if (movedHereMap.has(l.id)) return !hiddenSub || l.subgroup !== hiddenSub;
        return l.day_of_week === todayDayOfWeek &&
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

  useEffect(() => {
    fetchLessons();
  }, []);

  const handleScanSchedule = async () => {
    // 1. Питаємо дозвіл на доступ до медіа (галереї/камери)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Помилка', 'Для сканування розкладу потрібен доступ до фото.');
      return;
    }

    // 2. Відкриваємо ImagePicker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsLoading(true);
      const imageUri = result.assets[0].uri;
      
      try {
        // 3. Відправляємо в наш OCR-сервіс (симуляція ML Kit)
        await processScheduleImage(imageUri, todayDayOfWeek);
        Alert.alert('Успіх!', 'Розклад успішно розпізнано та імпортовано.');
        fetchLessons(); // Оновлюємо список
      } catch (err) {
        Alert.alert('Помилка OCR', 'Не вдалося розпізнати розклад з цього фото.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Сьогодні пар немає 🎉</Text>
      <TouchableOpacity style={styles.btnScan} onPress={handleScanSchedule}>
        <Text style={styles.btnScanText}>📸 Сканувати розклад</Text>
      </TouchableOpacity>
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
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        activationDistance={10}
        onDragBegin={() => setIsReordering(true)}
        onDragEnd={handleDragEnd}
        renderItem={({ item, drag }: RenderItemParams<Lesson>) => (
          <ScaleDecorator>
            <LessonCard
              lesson={item}
              isActive={item.id === activeLessonId}
              isReordering={isReordering}
              drag={drag}
              onDeleteSuccess={fetchLessons}
              displayDate={todayStr}
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
  btnScan: {
    marginTop: 20,
    backgroundColor: colors.primaryVariant,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnScanText: {
    color: colors.onBackground,
    fontWeight: 'bold',
    fontSize: 16,
  }
});
