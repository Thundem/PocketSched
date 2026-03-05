import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { getLessonsByDay } from '../db/database';
import * as ImagePicker from 'expo-image-picker';
import { processScheduleImage } from '../services/ocrScanner';
import { TimeEngine } from '../services/timeEngine';

const timeEngine = new TimeEngine();

export default function DayScheduleScreen() {
  const route = useRoute();
  const isTomorrow = route.name === 'Tomorrow'; // Визначаємо чи це вкладка "Завтра"
  
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
      const fetchedLessons = await getLessonsByDay(targetDayOfWeek);
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Помилка', 'Для сканування розкладу потрібен доступ до фото.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsLoading(true);
      const imageUri = result.assets[0].uri;
      
      try {
        await processScheduleImage(imageUri, targetDayOfWeek);
        Alert.alert('Успіх!', 'Розклад успішно розпізнано та імпортовано.');
        fetchLessons(); 
      } catch (err) {
        Alert.alert('Помилка OCR', 'Не вдалося розпізнати розклад з цього фото.');
      } finally {
        // setIsLoading is already set to false in fetchLessons or error body
        setIsLoading(false);
      }
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{isTomorrow ? 'Завтра пар немає 🎉' : 'Сьогодні пар немає 🎉'}</Text>
      {!isTomorrow && (
        <TouchableOpacity style={styles.btnScan} onPress={handleScanSchedule}>
          <Text style={styles.btnScanText}>📸 Сканувати розклад</Text>
        </TouchableOpacity>
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
        renderItem={({ item }) => (
          <LessonCard lesson={item} isActive={item.id === activeLessonId} />
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