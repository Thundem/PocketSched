import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Animated, TextInput, ScrollView, Linking, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { Lesson, WeekType } from '../db/schema';
import { Ionicons } from '@expo/vector-icons';
import { deleteLessonById, updateLesson, insertOverride } from '../db/database';

/** Додає хвилини до рядка часу "HH:mm" */
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Повертає час відображення для пари/пів пари.
 * 1 півпара = перші 40 хв від початку, 2 — останні 40 хв до кінця. */
function getDisplayTimes(lesson: Lesson): { start: string; end: string } {
  const halfMatch = lesson.lesson_type.match(/•\s*([12])\s*півпара/i);
  if (!halfMatch) return { start: lesson.start_time, end: lesson.end_time };
  if (halfMatch[1] === '1') return { start: lesson.start_time, end: addMinutes(lesson.start_time, 40) };
  return { start: addMinutes(lesson.end_time, -40), end: lesson.end_time };
}

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
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  displayDate?: string;
  isReordering?: boolean;
  drag?: () => void;
}

export default function LessonCard({ lesson, isActive, onDeleteSuccess, onMoveUp, onMoveDown, displayDate, isReordering, drag }: Props) {
  const navigation = useNavigation<any>();
  const [detailVisible, setDetailVisible] = useState(false);
  const [overridePickerVisible, setOverridePickerVisible] = useState(false);
  const [overrideNewDay, setOverrideNewDay] = useState(lesson.day_of_week);
  const [overrideNewStart, setOverrideNewStart] = useState(lesson.start_time);
  const [overrideNewEnd, setOverrideNewEnd] = useState(lesson.end_time);

  const openOverridePicker = () => {
    setOverrideNewDay(lesson.day_of_week);
    setOverrideNewStart(dispTimes.start);
    setOverrideNewEnd(dispTimes.end);
    setOverridePickerVisible(true);
  };

  // Ефект трясіння при режимі переміщення
  const jiggle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReordering) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(jiggle, {
            toValue: 0.35,
            duration: 140,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(jiggle, {
            toValue: -0.35,
            duration: 140,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => {
        anim.stop();
        Animated.timing(jiggle, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      };
    } else {
      Animated.timing(jiggle, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [isReordering]);
  const jiggleRotate = jiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-1deg', '0deg', '1deg'] });

  const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const dispTimes = getDisplayTimes(lesson);

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
    <Animated.View style={{ transform: [{ rotate: jiggleRotate }] }}>
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setDetailVisible(true)}
      onLongPress={drag}
      delayLongPress={300}
      style={[styles.card, isActive && styles.cardActive]}
    >
      {isActive && <View style={styles.activeIndicator} />}
      
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, isActive && styles.timeTextActive]}>{dispTimes.start}</Text>
        <Text style={styles.timeTextEnd}>{dispTimes.end}</Text>
      </View>

      <View style={styles.contentColumn}>
        <View style={styles.headerRow}>
          <Text style={styles.subjectName} numberOfLines={2}>{lesson.subject_name}</Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.typeBadge, lesson.lesson_type === 'Екзамен' && { backgroundColor: '#B71C1C' }]}>
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
          {/^https?:\/\/|^t\.me\//i.test(lesson.room_or_link ?? '') ? (
            <TouchableOpacity onPress={() => Linking.openURL(lesson.room_or_link!)}>
              <Text style={[styles.detailsText, styles.linkText]} numberOfLines={1}>{lesson.room_or_link}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.detailsText} numberOfLines={1}>{lesson.room_or_link}</Text>
          )}
        </View>

        <View style={styles.detailsRow}>
          <Ionicons name="person-outline" size={16} color={colors.inactive} />
          <Text style={styles.detailsText} numberOfLines={1}>{abbreviateTeacher(lesson.teacher)}</Text>
        </View>
      </View>
    </TouchableOpacity>
    </Animated.View>

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
            <Text style={styles.modalInfoText}>{dispTimes.start} – {dispTimes.end}</Text>
          </View>
          {lesson.exam_date ? (
            <View style={styles.modalRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.inactive} />
              <Text style={styles.modalInfoText}>{lesson.exam_date}</Text>
            </View>
          ) : null}
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
            {/^https?:\/\/|^t\.me\//i.test(lesson.room_or_link ?? '') ? (
              <TouchableOpacity onPress={() => Linking.openURL(lesson.room_or_link!)}>
                <Text style={[styles.modalInfoText, styles.linkText]}>{lesson.room_or_link}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.modalInfoText}>{lesson.room_or_link}</Text>
            )}
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

          {!lesson.exam_date && (
            <>
              {/* Підгрупа */}
              <View style={styles.weekTypeRow}>
                <Text style={styles.weekTypeLabel}>Підгрупа:</Text>
                {([{ val: '', label: 'Обидві' }, { val: '1', label: '1пг' }, { val: '2', label: '2пг' }]).map(({ val, label }) => (
                  <TouchableOpacity
                    key={val || 'all'}
                    style={[styles.weekTypeBtn, (lesson.subgroup || '') === val && styles.weekTypeBtnActive]}
                    onPress={async () => {
                      await updateLesson({ ...lesson, subgroup: val || undefined });
                      if (onDeleteSuccess) onDeleteSuccess();
                      setDetailVisible(false);
                    }}
                  >
                    <Text style={[styles.weekTypeBtnText, (lesson.subgroup || '') === val && styles.weekTypeBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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

              {/* Порядок у розкладі */}
              {(onMoveUp || onMoveDown) && (
                <View style={styles.weekTypeRow}>
                  <Text style={styles.weekTypeLabel}>Порядок:</Text>
                  <TouchableOpacity
                    style={[styles.weekTypeBtn, !onMoveUp && { opacity: 0.3 }]}
                    disabled={!onMoveUp}
                    onPress={() => { onMoveUp?.(); setDetailVisible(false); }}
                  >
                    <Ionicons name="arrow-up" size={16} color={onMoveUp ? colors.onSurface : colors.inactive} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.weekTypeBtn, !onMoveDown && { opacity: 0.3 }]}
                    disabled={!onMoveDown}
                    onPress={() => { onMoveDown?.(); setDetailVisible(false); }}
                  >
                    <Ionicons name="arrow-down" size={16} color={onMoveDown ? colors.onSurface : colors.inactive} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Одноразовий перенос */}
              <TouchableOpacity
                style={styles.overrideBtn}
                onPress={openOverridePicker}
              >
                <Ionicons name="calendar-clear-outline" size={16} color={colors.primary} />
                <Text style={styles.overrideBtnText}>Одноразово перенести...</Text>
              </TouchableOpacity>
            </>
          )}

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

    {/* Модал одноразового переносу */}
    <Modal
      visible={overridePickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setOverridePickerVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setOverridePickerVisible(false)}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalSubject}>Одноразовий перенос</Text>
          <Text style={styles.overrideHint}>«{lesson.subject_name}» цього разу відбудеться у:</Text>

          <View style={[styles.weekTypeRow, { marginTop: 12, flexWrap: 'wrap' }]}>
            {DAY_NAMES.map((name, idx) => {
              const dayNum = idx + 1;
              return (
                <TouchableOpacity
                  key={dayNum}
                  style={[styles.weekTypeBtn, overrideNewDay === dayNum && styles.weekTypeBtnActive]}
                  onPress={() => setOverrideNewDay(dayNum)}
                >
                  <Text style={[styles.weekTypeBtnText, overrideNewDay === dayNum && styles.weekTypeBtnTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.overrideHint, { marginTop: 16 }]}>Час проведення:</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInputWrap}>
              <Text style={styles.timeInputLabel}>Початок</Text>
              <TextInput
                style={styles.timeInput}
                value={overrideNewStart}
                onChangeText={setOverrideNewStart}
                placeholder="08:30"
                placeholderTextColor={colors.inactive}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <Text style={styles.timeSeparator}>–</Text>
            <View style={styles.timeInputWrap}>
              <Text style={styles.timeInputLabel}>Кінець</Text>
              <TextInput
                style={styles.timeInput}
                value={overrideNewEnd}
                onChangeText={setOverrideNewEnd}
                placeholder="10:05"
                placeholderTextColor={colors.inactive}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.overrideSaveBtn}
            onPress={async () => {
              // Обчислюємо original_date: дата цього тижня, коли пара мала відбутися
              const base = displayDate ? (() => {
                const [d, m, y] = displayDate.split('.').map(Number);
                return new Date(y, m - 1, d);
              })() : new Date();
              const baseDow = base.getDay() === 0 ? 7 : base.getDay();
              const orig = new Date(base);
              orig.setDate(base.getDate() + (lesson.day_of_week - baseDow));
              const p = (n: number) => String(n).padStart(2, '0');
              const originalDate = `${p(orig.getDate())}.${p(orig.getMonth() + 1)}.${orig.getFullYear()}`;
              await insertOverride({
                id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
                lesson_id: lesson.id,
                original_date: originalDate,
                new_day_of_week: overrideNewDay,
                new_start_time: overrideNewStart.trim() || null,
                new_end_time: overrideNewEnd.trim() || null,
              });
              setOverridePickerVisible(false);
              setDetailVisible(false);
              if (onDeleteSuccess) onDeleteSuccess();
            }}
          >
            <Ionicons name="checkmark-outline" size={20} color="#fff" />
            <Text style={styles.modalBtnText}>Зберегти</Text>
          </TouchableOpacity>
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
  linkText: {
    color: '#4FC3F7',
    textDecorationLine: 'underline',
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
  overrideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  overrideBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  overrideHint: {
    color: colors.onSurface,
    fontSize: 14,
    marginBottom: 4,
  },
  overrideSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  timeInputWrap: {
    flex: 1,
  },
  timeInputLabel: {
    color: colors.inactive,
    fontSize: 12,
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: colors.background,
    color: colors.onBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    fontSize: 16,
    textAlign: 'center',
  },
  timeSeparator: {
    color: colors.inactive,
    fontSize: 18,
    marginTop: 20,
  },
});