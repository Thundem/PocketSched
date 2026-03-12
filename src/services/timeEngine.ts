// src/services/timeEngine.ts
import { Lesson, WeekType } from '../db/schema';

/**
 * Модуль синхронізації часу (Time Engine)
 */

export class TimeEngine {
  // Стартова дата для розрахунку парності тижнів.
  private semesterStartDate: Date;

  constructor(startDate?: Date) {
    if (startDate) {
      this.semesterStartDate = startDate;
    } else {
      // Якщо дати немає, беремо 1 вересня поточного навчального року
      // Якщо зараз січень-серпень (0-7), то навчальний рік почався торік
      const now = new Date();
      const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
      this.semesterStartDate = new Date(startYear, 8, 1); // 1 Вересня
    }
  }

  /**
   * Калькулятор тижнів.
   * Вираховує, який зараз тиждень (NUMERATOR - чисельник (непарний), DENOMINATOR - знаменник (парний)).
   * Базується на різниці між поточною датою і відправною точкою.
   */
  public getCurrentWeekType(currentDate: Date = new Date()): WeekType {
    const diffTime = currentDate.getTime() - this.semesterStartDate.getTime();
    if (diffTime < 0) return 'NUMERATOR'; // Якщо стоїть якась дата до старту (захист від помилок)

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    const currentWeekNumber = Math.floor(diffDays / 7) + 1; // +1, бо 1й тиждень - це дні 0-6

    return currentWeekNumber % 2 !== 0 ? 'NUMERATOR' : 'DENOMINATOR';
  }

  /**
   * Визначає, чи йде зараз пара. Враховує поточний тиждень та час.
   */
  public getActiveLesson(lessons: Lesson[], currentDate: Date = new Date()): Lesson | null {
    const currentWeekType = this.getCurrentWeekType(currentDate);
    const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // JS Sunday is 0, we need 1-7
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    return lessons.find((lesson) => {
      // Якщо день тижня не співпадає, пропускаємо
      if (lesson.day_of_week !== dayOfWeek) return false;
      
      // Якщо тиждень не ALL (кожного тижня) і не співпадає з поточним, пропускаємо
      if (lesson.week_type !== 'ALL' && lesson.week_type !== currentWeekType) return false;

      const [startH, startM] = lesson.start_time.split(':').map(Number);
      const [endH, endM] = lesson.end_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // Пара вважається активною, якщо поточний час лежить у її проміжку
      // Для пів пари: 1пп = перші 40 хв від початку, 2пп = останні 40 хв до кінця
      const halfMatch = lesson.lesson_type.match(/•\s*([12])\s*півпара/i);
      if (halfMatch) {
        return halfMatch[1] === '1'
          ? currentMinutes >= startMinutes && currentMinutes < startMinutes + 40
          : currentMinutes >= endMinutes - 40 && currentMinutes <= endMinutes;
      }
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }) || null;
  }
}
