import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { Lesson } from '../db/schema';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  lesson: Lesson;
  isActive?: boolean; // Для підсвічування поточної пари
}

export default function LessonCard({ lesson, isActive }: Props) {
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {isActive && <View style={styles.activeIndicator} />}
      
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, isActive && styles.timeTextActive]}>{lesson.start_time}</Text>
        <Text style={styles.timeTextEnd}>{lesson.end_time}</Text>
      </View>

      <View style={styles.contentColumn}>
        <View style={styles.headerRow}>
          <Text style={styles.subjectName} numberOfLines={2}>{lesson.subject_name}</Text>
          <View style={styles.badgeContainer}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{lesson.lesson_type}</Text>
            </View>
            {lesson.week_type !== 'ALL' && (
              <View style={[styles.weekBadge, { backgroundColor: lesson.week_type === 'NUMERATOR' ? '#FFB74D' : '#81C784' }]}>
                <Text style={styles.weekText}>
                  {lesson.week_type === 'NUMERATOR' ? 'Ч' : 'З'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Ionicons name="location-outline" size={16} color={colors.inactive} />
          <Text style={styles.detailsText} numberOfLines={1}>{lesson.room_or_link}</Text>
        </View>

        <View style={styles.detailsRow}>
          <Ionicons name="person-outline" size={16} color={colors.inactive} />
          <Text style={styles.detailsText} numberOfLines={1}>{lesson.teacher}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
  },
  timeColumn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.separator,
    paddingRight: 10,
    marginRight: 10,
  },
  timeText: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeTextActive: {
    color: colors.primary,
  },
  timeTextEnd: {
    color: colors.inactive,
    fontSize: 14,
    marginTop: 4,
  },
  contentColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectName: {
    color: colors.onBackground,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeBadge: {
    backgroundColor: colors.separator,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: '500',
  },
  weekBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailsText: {
    color: colors.inactive,
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
});