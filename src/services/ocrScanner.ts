import * as FileSystem from 'expo-file-system/legacy';
import { Lesson } from '../db/schema';
import { insertLesson, clearLessonsByDay } from '../db/database';

// Відповідність українських назв днів тижня до числових значень (1=Пн, 7=Нд)
const DAY_NAMES: Record<string, number> = {
  'понеділок': 1, 'понеділку': 1,
  'вівторок': 2,  'вівторку': 2,
  'середа': 3,    'середу': 3,
  'четвер': 4,    'четверг': 4,
  "п'ятниця": 5,  "п'ятницю": 5, 'пятниця': 5, 'пятницю': 5,
  'субота': 6,    'суботу': 6,
  'неділя': 7,    'неділю': 7,
};

/** Визначає день тижня з тексту OCR. Повертає null, якщо не знайдено. */
function detectDayFromText(text: string): number | null {
  const lower = text.toLowerCase();
  for (const [name, num] of Object.entries(DAY_NAMES)) {
    if (lower.includes(name)) return num;
  }
  return null;
}

/**
 * Перевіряє чи рядок є заголовком дня (містить назву дня, але НЕ містить часу).
 * Рядки з часом — це пари, а не заголовки.
 */
function extractDayFromLine(line: string): number | null {
  if (/([01]?\d|2[0-3]):[0-5]\d/.test(line)) return null; // є час — це пара
  return detectDayFromText(line);
}

/** Перевіряє чи рядок виглядає як дата (наприклад "05.03.2026" або "5 березня") */
function isDateLine(line: string): boolean {
  return (
    /^\d{1,2}[./]\d{1,2}([./]\d{2,4})?$/.test(line) ||
    /^\d{1,2}\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)/i.test(line)
  );
}

/**
 * Функція для розпізнавання тексту з фото розкладу та його обробки 
 * Використовує безкоштовний OCR.space API (розуміє українську!)
 */
export const processScheduleImage = async (imageUri: string, fallbackDay: number) => {
  console.log('Початок Cloud OCR-сканування файлу:', imageUri);
  
  let rawOcrText = '';

  try {
    // 1. Конвертуємо зображення в Base64 формат для відправки
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64' as any,
    });
    const base64DataUri = `data:image/jpeg;base64,${base64Image}`;

    // 2. Відправляємо на OCR.space з підтримкою кирилиці (rus/ukr 엔진 схожі)
    // Використовуємо OCREngine 2, він краще працює з таблицями
    const formData = new FormData();
    formData.append('base64Image', base64DataUri);
    formData.append('language', 'rus'); // Движок 'rus' найкраще зчитує українські літери
    formData.append('OCREngine', '2'); 
    formData.append('isTable', 'true');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': 'helloworld', // Безкоштовний тестовий ключ
      },
      body: formData,
    });

    const result = await response.json();
    
    if (result.IsErroredOnProcessing || !result.ParsedResults) {
      throw new Error(`Помилка API розпізнавання: ${result.ErrorMessage}`);
    }

    rawOcrText = result.ParsedResults[0].ParsedText;
    console.log('Отриманий текст з OCR.space:\n', rawOcrText);

  } catch (error) {
    console.error("Помилка розпізнавання OCR:", error);
    throw new Error("Не вдалося розпізнати текст через інтернет.");
  }

  // 3. Парсимо рядки таблиці:
  //    Нова пара починається з рядка виду "1   08:30 ..." (номер пари + час).
  //    Усі наступні рядки до наступного такого — продовження цієї пари.
  const parsedLessons: Lesson[] = [];
  let detectedDay: number | null = null;
  let stopping = false;

  // Рядок є початком пари: починається з цифри(номера), потім пробіли, потім час
  // Напр: "1       08:30   Назва", "7 18:10"
  const newLessonRe = /^\d+\s+([01]?\d|2[0-3]):[0-5]\d/;

  const allLines = rawOcrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let currentBlock: string[] = [];

  for (const line of allLines) {
    if (stopping) break;

    // Пропускаємо рядки-дати
    if (isDateLine(line)) continue;

    // Обробляємо заголовки дня
    const lineDay = extractDayFromLine(line);
    if (lineDay !== null) {
      if (detectedDay === null) {
        detectedDay = lineDay;
        console.log(`OCR: день "${line}" → ${detectedDay}`);
      } else if (lineDay !== detectedDay) {
        stopping = true;
      }
      continue;
    }

    if (newLessonRe.test(line)) {
      // Зберігаємо попередній блок перед початком нового
      if (currentBlock.length > 0) {
        const lesson = extractLessonFromUkrText(currentBlock.join(' '), detectedDay ?? fallbackDay);
        if (lesson) parsedLessons.push(lesson);
      }
      currentBlock = [line];
    } else {
      // Продовження поточної пари (перенесений рядок, викладач, аудиторія)
      currentBlock.push(line);
    }
  }

  // Зберігаємо останній блок
  if (currentBlock.length > 0) {
    const lesson = extractLessonFromUkrText(currentBlock.join(' '), detectedDay ?? fallbackDay);
    if (lesson) parsedLessons.push(lesson);
  }

  const finalDay = detectedDay ?? fallbackDay;
  console.log(`Визначений день тижня: ${finalDay}, знайдено пар: ${parsedLessons.length}`);

  // 4. Очищаємо тільки знайдений день і вставляємо нові пари
  await clearLessonsByDay(finalDay);
  for (const l of parsedLessons) {
    await insertLesson(l);
  }

  return parsedLessons;
};

const extractLessonFromUkrText = (text: string, dayOfWeek: number): Lesson | null => {
  // Витягуємо час
  const timeRegex = /([01]?\d|2[0-3]):[0-5]\d/gi;
  const timeMatches = text.match(timeRegex);
  
  if (!timeMatches) return null; // Якщо немає часу, це не пара

  let startTime = timeMatches[0];
  let endTime = timeMatches.length > 1 ? timeMatches[1] : '00:00';

  if (timeMatches.length === 1) {
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + 80); // + 1 год 20 хв
    endTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  // Витягуємо тип тижня
  let weekType: 'ALL' | 'NUMERATOR' | 'DENOMINATOR' = 'ALL';
  if (/\b(Ч|Чис|Чисельник|підгр\. 1|1 підгр)\b/i.test(text)) weekType = 'NUMERATOR';
  else if (/\b(З|Знам|Знаменник|підгр\. 2|2 підгр)\b/i.test(text)) weekType = 'DENOMINATOR';

  // Витягуємо підгрупу (1 або 2)
  let subgroup: string | undefined = undefined;
  const subgroupMatch = text.match(/підгр[\s.]*(\d)/i);
  if (subgroupMatch) subgroup = subgroupMatch[1];

  // Витягуємо індикатор "1 півпара" або "2 півпара"
  let halfLesson = '';
  const halfMatch = text.match(/([12])\s*півпара/i);
  if (halfMatch) halfLesson = ` • ${halfMatch[1]}П`;

  // Витягуємо тип заняття
  let lessonType = 'Лекція';
  if (/\b(Лаб|ЛР|Лабораторна)\b/i.test(text)) lessonType = 'Лабораторна';
  else if (/\b(ПрС|Прак|Практика)\b/i.test(text)) lessonType = 'Практика';
  lessonType = lessonType + halfLesson;

  // Очищаємо текст від службових маркерів
  let cleanText = text
    .replace(/^\d+\s+/, '')              // видаляємо номер пари на початку ("1 ", "7 ")
    .replace(/([01]?\d|2[0-3]):[0-5]\d/gi, '')
    .replace(/[12]\s*півпара\s*/gi, '')
    .replace(/підгр[\s.]*\d/gi, '')
    .replace(/\b(Лаб|ЛР|Лабораторна|ПрС|Прак|Практика|Лекція|Лек|\(\)|\[\])\b/gi, '')
    // Видаляємо назви місяців і дати щоб вони не потрапляли в назву предмету
    .replace(/\b\d{1,2}[.\/]\d{1,2}([.\/]\d{2,4})?\b/g, '')
    .replace(/\b(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\b/gi, '')
    // Видаляємо назви днів тижня
    .replace(/\b(понеділок|вівторок|середа|четвер|п'ятниця|пятниця|субота|неділя|понеділку|вівторку|середу|четверга|п'ятниці|суботи|неділі)\b/gi, '')
    .replace(/\t/g, ' ')
    .trim();

  // Шукаємо викладача (починається з посади)
  let teacher = 'Невідомо';
  const teacherMatches = cleanText.match(/(доцент|асистент|професор|старший викладач|викладач)[^\d]+/i);
  if (teacherMatches) {
     teacher = teacherMatches[0].trim();
     cleanText = cleanText.replace(teacher, '').trim();
  }

  // Шукаємо аудиторію (Наприклад 213/Т, 5/Б, Н12/Т)
  let room = 'Не вказано';
  const roomMatches = cleanText.match(/([0-9A-ZА-ЯІЇЄ]{1,4}\/[A-ZА-ЯІЇЄ]{1,3}|[a-zA-ZА-Яа-яіє]{1,2}[0-9]{1,3}\/[a-zA-ZА-Яа-яіє]+|[0-9]{3}[A-ZА-ЯІЇЄ]?)/i);
  if (roomMatches) {
     room = roomMatches[0].trim();
     cleanText = cleanText.replace(room, '').trim();
  }

  // Те, що залишилось - це назва предмету
  const words = cleanText.split(' ').filter(w => w.length > 2);

  // Якщо після очищення не залишилось значущого тексту — клітинка порожня, пару пропускаємо
  // (достатньо мінімум 2 слова або 1 слово довше 4 символів, щоб вважати це назвою предмету)
  const hasSubject = words.length >= 2 || (words.length === 1 && words[0].length > 4);
  if (!hasSubject) return null;

  const subjectName = words.slice(0, 6).join(' ');

  return {
    id: Math.random().toString(),
    subject_name: subjectName.substring(0, 60),
    lesson_type: lessonType,
    teacher: teacher.length > 40 ? teacher.substring(0, 40) + '...' : teacher,
    room_or_link: room.length > 20 ? room.substring(0, 20) + '...' : room,
    start_time: startTime,
    end_time: endTime,
    day_of_week: dayOfWeek,
    subgroup: subgroup,
    week_type: weekType,
  };
};
