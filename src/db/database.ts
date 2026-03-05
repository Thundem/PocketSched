import * as SQLite from 'expo-sqlite';
import { Lesson } from './schema';

// Функція для створення/очищення бази даних та підготовки таблиць
export const initDb = async () => {
  const db = await SQLite.openDatabaseAsync('pocketsched.db');
  
  await db.execAsync(`
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
};

export const insertLesson = async (lesson: Lesson) => {
  const db = await SQLite.openDatabaseAsync('pocketsched.db');
  await db.runAsync(
    `INSERT INTO lessons (id, subject_name, lesson_type, teacher, room_or_link, start_time, end_time, day_of_week, subgroup, week_type) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
};

export const getLessonsByDay = async (day_of_week: number): Promise<Lesson[]> => {
  const db = await SQLite.openDatabaseAsync('pocketsched.db');
  const allRows = await db.getAllAsync<Lesson>(
    `SELECT * FROM lessons WHERE day_of_week = ? ORDER BY start_time ASC`,
    [day_of_week]
  );
  return allRows;
};

export const getAllLessons = async (): Promise<Lesson[]> => {
  const db = await SQLite.openDatabaseAsync('pocketsched.db');
  const allRows = await db.getAllAsync<Lesson>(
    `SELECT * FROM lessons ORDER BY day_of_week ASC, start_time ASC`
  );
  return allRows;
};

export const clearAllLessons = async () => {
  const db = await SQLite.openDatabaseAsync('pocketsched.db');
  await db.runAsync('DELETE FROM lessons');
};
