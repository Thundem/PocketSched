import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { getLessonsByDay, clearLessonsByDay } from '../db/database';
import * as ImagePicker from 'expo-image-picker';
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
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      navigation.navigate('CropScreen', {
        imageUri: result.assets[0].uri,
        targetDay: targetDayOfWeek,
      });
    }
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
        <Text style={styles.emptyHint}>Натисніть кнопку нижче, щоб відсканувати розклад</Text>
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
          <LessonCard
            lesson={item}
            isActive={item.id === activeLessonId}
            onDeleteSuccess={fetchLessons}
          />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
      />
      {!isTomorrow && (
        <TouchableOpacity style={styles.fab} onPress={handleScanSchedule}>
          <Ionicons name="camera-outline" size={22} color="#fff" />
          <Text style={styles.fabText}>Сканувати</Text>
        </TouchableOpacity>
      )}
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
});