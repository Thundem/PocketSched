import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson, WeekType } from '../db/schema';
import { Ionicons } from '@expo/vector-icons';
import { deleteLessonById, updateLesson } from '../db/database';

/** Скорочує повне ім'я викладача до формату "Прізвище І.П."
 * Напр.: "доцент Іваненко Іван Петрович" → "Іваненко І.П." */
function abbreviateTeacher(name: string): string {
  if (!name || name === 'Невідомо') return name;
  const cleaned = name
    .replace(/\(.*?\)/g, '')   // видаляємо все у дужках (зовн., щось)
    .replace(/\[.*?\]/g, '')   // видаляємо квадратні дужки
    .replace(/^(доцент|асистент|професор|старший викладач|викладач)\s*/gi, '')
    .trim();
  // Лишаємо тільки слова що починаються на кириличну літеру
  const parts = cleaned.split(/\s+/).filter(p => /^[А-ЯІЇЄа-яіїє]/i.test(p));
  if (parts.length < 2) return cleaned.trim() || name;
  // Прізвище + перші 2 ініціали (ім'я та по-батькові)
  const initials = parts.slice(1, 3).map((p: string) => p.charAt(0).toUpperCase() + '.').join('');
  return `${parts[0]} ${initials}`;
}

interface Props {
  lesson: Lesson;
  isActive?: boolean;
  onDeleteSuccess?: () => void; 
}

export default function LessonCard({ lesson, isActive, onDeleteSuccess }: Props) {
  const navigation = useNavigation<any>();
  const [detailVisible, setDetailVisible] = useState(false);
  const [dayPickerVisible, setDayPickerVisible] = useState(false);

  const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  const handleDelete = () => {
    setDetailVisible(false);
    Alert.alert(
      'Видалити пару?',
      `Видалити "${lesson.subject_name}"?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLessonById(lesson.id);
              if (onDeleteSuccess) onDeleteSuccess();
            } catch (error) {
              console.error('Failed to delete lesson:', error);
              Alert.alert('Помилка', 'Не вдалося видалити пару.');
            }
          },
        },
      ]
    );
  };

  return (
    <>
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setDetailVisible(true)}
      onLongPress={() => setDayPickerVisible(true)}
      style={[styles.card, isActive && styles.cardActive]}
    >
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
            {lesson.subgroup && (
              <View style={[styles.weekBadge, { backgroundColor: '#42A5F5' }]}>
                <Text style={styles.weekText}>{lesson.subgroup}пг</Text>
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
          <Text style={styles.detailsText} numberOfLines={1}>{abbreviateTeacher(lesson.teacher)}</Text>
        </View>
      </View>
    </TouchableOpacity>

    <Modal
      visible={detailVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setDetailVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setDetailVisible(false)}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalSubject}>{lesson.subject_name}</Text>

          <View style={styles.modalRow}>
            <Ionicons name="time-outline" size={18} color={colors.inactive} />
            <Text style={styles.modalInfoText}>{lesson.start_time} – {lesson.end_time}</Text>
          </View>
          <View style={styles.modalRow}>
            <Ionicons name="school-outline" size={18} color={colors.inactive} />
            <Text style={styles.modalInfoText}>{lesson.lesson_type}</Text>
          </View>
          <View style={styles.modalRow}>
            <Ionicons name="person-outline" size={18} color={colors.inactive} />
            <Text style={styles.modalInfoText}>{lesson.teacher}</Text>
          </View>
          <View style={styles.modalRow}>
            <Ionicons name="location-outline" size={18} color={colors.inactive} />
            <Text style={styles.modalInfoText}>{lesson.room_or_link}</Text>
          </View>
          {lesson.subgroup ? (
            <View style={styles.modalRow}>
              <Ionicons name="people-outline" size={18} color={colors.inactive} />
              <Text style={styles.modalInfoText}>Підгрупа {lesson.subgroup}</Text>
            </View>
          ) : null}
          {lesson.week_type !== 'ALL' ? (
            <View style={styles.modalRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.inactive} />
              <Text style={styles.modalInfoText}>
                {lesson.week_type === 'NUMERATOR' ? 'Чисельник' : 'Знаменник'}
              </Text>
            </View>
          ) : null}

          {/* Швидка зміна типу тижня */}
          <View style={styles.weekTypeRow}>
            <Text style={styles.weekTypeLabel}>Тиждень:</Text>
            {([{ val: 'ALL', label: 'Кожен' }, { val: 'NUMERATOR', label: 'Чисельник' }, { val: 'DENOMINATOR', label: 'Знаменник' }] as { val: WeekType; label: string }[]).map(({ val, label }) => (
              <TouchableOpacity
                key={val}
                style={[styles.weekTypeBtn, lesson.week_type === val && styles.weekTypeBtnActive]}
                onPress={async () => {
                  await updateLesson({ ...lesson, week_type: val });
                  if (onDeleteSuccess) onDeleteSuccess();
                  setDetailVisible(false);
                }}
              >
                <Text style={[styles.weekTypeBtnText, lesson.week_type === val && styles.weekTypeBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Перенести на інший день */}
          <View style={styles.weekTypeRow}>
            <Text style={styles.weekTypeLabel}>День:</Text>
            {DAY_NAMES.map((name, idx) => {
              const dayNum = idx + 1;
              return (
                <TouchableOpacity
                  key={dayNum}
                  style={[styles.weekTypeBtn, lesson.day_of_week === dayNum && styles.weekTypeBtnActive]}
                  onPress={async () => {
                    await updateLesson({ ...lesson, day_of_week: dayNum });
                    if (onDeleteSuccess) onDeleteSuccess();
                    setDetailVisible(false);
                  }}
                >
                  <Text style={[styles.weekTypeBtnText, lesson.day_of_week === dayNum && styles.weekTypeBtnTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalBtnEdit}
              onPress={() => {
                setDetailVisible(false);
                navigation.navigate('AddLesson', { lesson });
              }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.modalBtnText}>Редагувати</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnDelete} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.modalBtnText}>Видалити</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.separator,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSubject: {
    color: colors.onBackground,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalInfoText: {
    color: colors.onSurface,
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtnEdit: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalBtnDelete: {
    flex: 1,
    backgroundColor: '#c0392b',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  weekTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  weekTypeLabel: {
    color: colors.inactive,
    fontSize: 14,
    marginRight: 4,
  },
  weekTypeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inactive,
    backgroundColor: colors.surface,
  },
  weekTypeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVariant,
  },
  weekTypeBtnText: {
    color: colors.inactive,
    fontSize: 13,
    fontWeight: '600',
  },
  weekTypeBtnTextActive: {
    color: colors.primary,
  },
});