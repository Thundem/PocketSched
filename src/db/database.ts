import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { Lesson } from './schema';

// Заглушка (Mock) для WEB-версії
let webMockDatabase: Lesson[] = [];

// Singleton: одне підключення + гарантія ініціалізації перед будь-яким запитом
let _dbInstance: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<void> | null = null;

export const initDb = (): Promise<void> => {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    if (Platform.OS === 'web') {
      console.log('Running on Web. Mock database initialized.');
      return;
    }
    _dbInstance = await SQLite.openDatabaseAsync('pocketsched.db');
    await _dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY NOT NULL,
        subject_name TEXT NOT NULL,
        lesson_type TEXT NOT NULL,
        teacher TEXT,
        room_or_link TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        subgroup TEXT,
        week_type TEXT NOT NULL
      );
    `);
    // Міграція: додаємо exam_date якщо якщо ще немає
    try {
      await _dbInstance.execAsync(`ALTER TABLE lessons ADD COLUMN exam_date TEXT DEFAULT NULL`);
    } catch {}
  })();
  return _initPromise;
};

/** Повертає singleton-з'єднання, чекаючи завершення initDb */
const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  await initDb();
  return _dbInstance!;
};

export const insertLesson = async (lesson: Lesson) => {
  if (Platform.OS === 'web') {
    webMockDatabase.push(lesson);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO lessons (id, subject_name, lesson_type, teacher, room_or_link, start_time, end_time, day_of_week, subgroup, week_type, exam_date) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lesson.id,
      lesson.subject_name,
      lesson.lesson_type,
      lesson.teacher,
      lesson.room_or_link,
      lesson.start_time,
      lesson.end_time,
      lesson.day_of_week,
      lesson.subgroup || null,
      lesson.week_type,
      lesson.exam_date || null,
    ]
  );
};

export const getLessonsByDay = async (day_of_week: number, dateStr?: string): Promise<Lesson[]> => {
  if (Platform.OS === 'web') {
    const lessons = webMockDatabase
      .filter(l => l.day_of_week === day_of_week && !l.exam_date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const exams = dateStr ? webMockDatabase.filter(l => l.exam_date === dateStr) : [];
    return [...lessons, ...exams].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  const db = await getDb();
  if (dateStr) {
    return db.getAllAsync<Lesson>(
      `SELECT * FROM lessons WHERE (day_of_week = ? AND (exam_date IS NULL OR exam_date = '')) OR exam_date = ? ORDER BY start_time ASC`,
      [day_of_week, dateStr]
    );
  }
  return db.getAllAsync<Lesson>(
    `SELECT * FROM lessons WHERE day_of_week = ? AND (exam_date IS NULL OR exam_date = '') ORDER BY start_time ASC`,
    [day_of_week]
  );
};

export const getAllLessons = async (): Promise<Lesson[]> => {
  if (Platform.OS === 'web') {
    return webMockDatabase.sort((a, b) => {
      if (a.day_of_week === b.day_of_week) {
        return a.start_time.localeCompare(b.start_time);
      }
      return a.day_of_week - b.day_of_week;
    });
  }
  const db = await getDb();
  const allRows = await db.getAllAsync<Lesson>(
    `SELECT * FROM lessons ORDER BY day_of_week ASC, start_time ASC`
  );
  return allRows;
};

export const clearAllLessons = async () => {
  if (Platform.OS === 'web') {
    webMockDatabase = [];
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM lessons');
};

export const clearLessonsByDay = async (day_of_week: number) => {
  if (Platform.OS === 'web') {
    webMockDatabase = webMockDatabase.filter(l => l.day_of_week !== day_of_week || !!l.exam_date);
    return;
  }
  const db = await getDb();
  await db.runAsync(`DELETE FROM lessons WHERE day_of_week = ? AND (exam_date IS NULL OR exam_date = '')`, [day_of_week]);
};

export const deleteLessonById = async (id: string) => {
  if (Platform.OS === 'web') {
    webMockDatabase = webMockDatabase.filter(l => l.id !== id);
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM lessons WHERE id = ?', [id]);
};

export const updateLesson = async (lesson: Lesson) => {
  if (Platform.OS === 'web') {
    const index = webMockDatabase.findIndex(l => l.id === lesson.id);
    if (index > -1) {
      webMockDatabase[index] = lesson;
    }
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `UPDATE lessons 
     SET subject_name = ?, lesson_type = ?, teacher = ?, room_or_link = ?, start_time = ?, end_time = ?, day_of_week = ?, subgroup = ?, week_type = ?, exam_date = ?
     WHERE id = ?`,
    [
      lesson.subject_name,
      lesson.lesson_type,
      lesson.teacher,
      lesson.room_or_link,
      lesson.start_time,
      lesson.end_time,
      lesson.day_of_week,
      lesson.subgroup || null,
      lesson.week_type,
      lesson.exam_date || null,
      lesson.id
    ]
  );
};

