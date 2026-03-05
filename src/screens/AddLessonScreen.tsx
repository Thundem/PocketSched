import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { insertLesson, updateLesson } from '../db/database';
import { WeekType, Lesson } from '../db/schema';

export default function AddLessonScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  // Отримуємо пару для редагування, якщо вона була передана через навігацію
  const editLesson = route.params?.lesson as Lesson | undefined;

  const [subjectName, setSubjectName] = useState(editLesson?.subject_name || '');
  const [teacher, setTeacher] = useState(editLesson?.teacher || '');
  const [room, setRoom] = useState(editLesson?.room_or_link || '');
  const [startTime, setStartTime] = useState(editLesson?.start_time || '08:30');
  const [endTime, setEndTime] = useState(editLesson?.end_time || '10:05');
  const [lessonType, setLessonType] = useState(editLesson?.lesson_type || 'Л');
  const [weekType, setWeekType] = useState<WeekType>(editLesson?.week_type || 'ALL');
  const [dayOfWeek, setDayOfWeek] = useState(editLesson?.day_of_week || 1);

  // Динамічно міняємо заголовок вікна, в залежності від того, це редагування чи створення
  useEffect(() => {
    navigation.setOptions({ title: editLesson ? 'Редагувати пару' : 'Додати пару' });
  }, [editLesson, navigation]);

  const handleSave = async () => {
    if (!subjectName || !startTime || !endTime) {
      Alert.alert('Помилка', 'Заповніть обов\'язкові поля: Назва, Час початку та кінця');
      return;
    }

    try {
      const lessonData: Lesson = {
        id: editLesson ? editLesson.id : Math.random().toString(),
        subject_name: subjectName,
        lesson_type: lessonType,
        teacher,
        room_or_link: room,
        start_time: startTime,
        end_time: endTime,
        day_of_week: dayOfWeek,
        week_type: weekType
      };

      if (editLesson) {
        await updateLesson(lessonData);
      } else {
        await insertLesson(lessonData);
      }
      
      navigation.goBack();
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося зберегти пару');
      console.error(e);
    }
  };

  const days = ['Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const types = ['Л', 'Лаб', 'ПрС'];
  const weeks = [{ label: 'Кожен', val: 'ALL' }, { label: 'Чисельник', val: 'NUMERATOR' }, { label: 'Знаменник', val: 'DENOMINATOR' }];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Назва */}
      <Text style={styles.label}>Назва предмету *</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Вища математика..." 
        placeholderTextColor={colors.inactive}
        value={subjectName} 
        onChangeText={setSubjectName} 
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Аудиторія / Лінк</Text>
          <TextInput style={styles.input} placeholder="Ауд. 402" placeholderTextColor={colors.inactive} value={room} onChangeText={setRoom} />
        </View>
        <View style={{ width: 16 }} />
        <View style={styles.flex1}>
          <Text style={styles.label}>Викладач</Text>
          <TextInput style={styles.input} placeholder="Іванов І.І." placeholderTextColor={colors.inactive} value={teacher} onChangeText={setTeacher} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Початок (HH:MM) *</Text>
          <TextInput style={styles.input} placeholder="08:30" placeholderTextColor={colors.inactive} value={startTime} onChangeText={setStartTime} />
        </View>
        <View style={{ width: 16 }} />
        <View style={styles.flex1}>
          <Text style={styles.label}>Кінець (HH:MM) *</Text>
          <TextInput style={styles.input} placeholder="10:05" placeholderTextColor={colors.inactive} value={endTime} onChangeText={setEndTime} />
        </View>
      </View>

      {/* День тижня */}
      <Text style={styles.label}>День тижня</Text>
      <View style={styles.segmentWrap}>
        {days.map((d, index) => (
          <TouchableOpacity 
            key={d} 
            style={[styles.segmentBtn, dayOfWeek === index + 1 && styles.segmentBtnActive]}
            onPress={() => setDayOfWeek(index + 1)}
          >
            <Text style={[styles.segmentText, dayOfWeek === index + 1 && styles.segmentTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Тип пари */}
      <Text style={styles.label}>Тип пари</Text>
      <View style={styles.segmentWrap}>
        {types.map(t => (
          <TouchableOpacity 
            key={t} 
            style={[styles.segmentBtn, lessonType === t && styles.segmentBtnActive]}
            onPress={() => setLessonType(t)}
          >
            <Text style={[styles.segmentText, lessonType === t && styles.segmentTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Тип тижня */}
      <Text style={styles.label}>Який тиждень</Text>
      <View style={styles.segmentWrap}>
        {weeks.map(w => (
          <TouchableOpacity 
            key={w.val} 
            style={[styles.segmentBtn, weekType === w.val && styles.segmentBtnActive]}
            onPress={() => setWeekType(w.val as WeekType)}
          >
            <Text style={[styles.segmentText, weekType === w.val && styles.segmentTextActive]}>{w.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Зберегти пару</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  label: {
    color: colors.onSurface,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.onBackground,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flex1: {
    flex: 1,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.separator,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.separator,
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryVariant,
  },
  segmentText: {
    color: colors.inactive,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.onBackground,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  }
});