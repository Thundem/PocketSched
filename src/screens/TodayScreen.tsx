import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { getLessonsByDay, insertLesson, clearAllLessons } from '../db/database';
import * as ImagePicker from 'expo-image-picker';
import { processScheduleImage } from '../services/ocrScanner';

export default function TodayScreen() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string>('');

  const todayDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const fetchedLessons = await getLessonsByDay(todayDayOfWeek);
      setLessons(fetchedLessons);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
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
