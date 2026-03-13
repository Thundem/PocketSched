import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import LessonCard from '../components/LessonCard';
import { clearLessonsByDay } from '../db/database';
import { Ionicons } from '@expo/vector-icons';
import { useScheduleLessons } from '../hooks/useScheduleLessons';

export default function DayScheduleScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const isTomorrow = route.name === 'Tomorrow';
  const [isReordering, setIsReordering] = useState(false);

  const { lessons, isLoading, activeLessonId, refresh, handleDragEnd, dateStr } =
    useScheduleLessons(isTomorrow);

  const targetDayOfWeek = (() => {
    const d = new Date();
    if (isTomorrow) d.setDate(d.getDate() + 1);
    return d.getDay() === 0 ? 7 : d.getDay();
  })();

  const onDragEnd = useCallback(
    async (args: { data: Lesson[] }) => {
      setIsReordering(false);
      await handleDragEnd(args);
    },
    [handleDragEnd],
  );

  const handleClearDay = useCallback(() => {
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
            refresh();
          },
        },
      ],
    );
  }, [targetDayOfWeek, refresh]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        lessons.length > 0 ? (
          <TouchableOpacity style={{ marginRight: 16, padding: 4 }} onPress={handleClearDay}>
            <Ionicons name="trash-outline" size={22} color="#ff4d4d" />
          </TouchableOpacity>
        ) : undefined,
    });
  }, [navigation, lessons.length, handleClearDay]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{isTomorrow ? 'Завтра пар немає 🎉' : 'Сьогодні пар немає 🎉'}</Text>
      {!isTomorrow && (
        <Text style={styles.emptyHint}>Натисніть іконку камери вгорі, щоб відсканувати розклад</Text>
      )}
    </View>
  ), [isTomorrow]);

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
        onDragBegin={() => setIsReordering(true)}
        onDragEnd={onDragEnd}
        renderItem={({ item, drag }: RenderItemParams<Lesson>) => (
          <ScaleDecorator>
            <LessonCard
              lesson={item}
              isActive={item.id === activeLessonId}
              isReordering={isReordering}
              drag={drag}
              onDeleteSuccess={refresh}
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