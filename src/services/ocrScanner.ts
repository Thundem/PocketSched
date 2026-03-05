import * as ImagePicker from 'expo-image-picker';
import { Lesson } from '../db/schema';
import { insertLesson, clearAllLessons } from '../db/database';

// Тимчасовий мок-перехід доки ми знаходимось в Expo Go.
// Для справжнього офлайн Google ML Kit необхідно зробити "npx expo prebuild"
// та використовувати: import TextRecognition from '@react-native-ml-kit/text-recognition';

/**
 * Функція для розпізнавання тексту з фото розкладу та його обробки 
 * алгоритмом видобування полів (парсинг: час, аудиторія, тиждень і тд.)
 */
export const processScheduleImage = async (imageUri: string, dayOfWeek: number) => {
  console.log('Початок OCR-сканування файлу:', imageUri);
  
  // TODO: Тут буде реальний виклик до Google ML Kit:
  // const result = await TextRecognition.recognize(imageUri);
  // const textBlocks = result.blocks.map(b => b.text);
  
  // Нині ми спершу згенеруємо "сирий розпізнаний текст", що міг би зчитати ML Kit:
  // Цей текст відповідатиме одному дню.
  const rawOcrText = [
    "08:30 10:05", "Вища математика Л", "Ч", "Петренко", "ауд. 402",
    "10:25 12:00", "Програмування Лаб", "Знам", "Іванов", "ауд. 211",
    "12:20 13:55", "Web-дизайн ПрС", "Сидоренко", "онлайн"
  ].join('\n');

  console.log('Отриманий текст з OCR:\n', rawOcrText);

  // Наш алгоритм парсингу
  // Правила:
  // 1. Час - XX:XX
  // 2. Тип тижня - маркер ("Ч", "З", "Чис", "Знам")
  // 3. Тип пари - ("Л", "Лаб", "ПрС")
  
  const parsedLessons: Lesson[] = [];
  const lines = rawOcrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Проста евристика: якщо знаходимо час, ми починаємо "збирати" нову пару.
  const timeRegex = /([01]?\d|2[0-3]):[0-5]\d/gi;
  let currentGroup: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(timeRegex) && currentGroup.length > 0) {
      // зберегти попередню пару і почати нову
      const lesson = extractLessonFromGroup(currentGroup, dayOfWeek);
      if (lesson) parsedLessons.push(lesson);
      currentGroup = [line];
    } else {
      currentGroup.push(line);
    }
  }
  // Зберегти останню
  if (currentGroup.length > 0) {
    const lesson = extractLessonFromGroup(currentGroup, dayOfWeek);
    if (lesson) parsedLessons.push(lesson);
  }

  // Очистимо старі пари перед вставленням нових з картинки!
  await clearAllLessons();

  // Вставка нових пар у БД
  for (const l of parsedLessons) {
    await insertLesson(l);
  }

  console.log(`Успішно імпортовано та збережено ${parsedLessons.length} пар!`);
  return parsedLessons;
};

const extractLessonFromGroup = (group: string[], dayOfWeek: number): Lesson | null => {
  const mergedText = group.join(' ');
  
  // 1. Пошук часу
  const timeMatches = mergedText.match(/([01]?\d|2[0-3]):[0-5]\d/g);
  let startTime = '00:00';
  let endTime = '00:00';
  
  if (timeMatches && timeMatches.length >= 2) {
    startTime = timeMatches[0];
    endTime = timeMatches[1];
  } else if (timeMatches && timeMatches.length === 1) {
    startTime = timeMatches[0];
    // Обчислюємо приблихний кінець + 1год 35хв як дефолт
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + 95);
    endTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  // 2. Пошук типу тижня
  let weekType: 'ALL' | 'NUMERATOR' | 'DENOMINATOR' = 'ALL';
  const numRegex = /\b(Ч|Чис|Чисельник)\b/i;
  const denRegex = /\b(З|Знам|Знаменник)\b/i;
  
  if (numRegex.test(mergedText)) weekType = 'NUMERATOR';
  else if (denRegex.test(mergedText)) weekType = 'DENOMINATOR';

  // 3. Пошук типу пари
  let lessonType = 'Л'; // Лекція за замовчуванням
  const labRegex = /\b(Лаб|ЛР|Лабораторна)\b/i;
  const prRegex = /\b(ПрС|Прак|Практика)\b/i;
  
  if (labRegex.test(mergedText)) lessonType = 'Лаб';
  else if (prRegex.test(mergedText)) lessonType = 'ПрС';

  // 4. Очищення назви (проста стратегія: забираємо час з рядка, беремо перший найдовший шматок як назву)
  let cleanText = mergedText
    .replace(/([01]?\d|2[0-3]):[0-5]\d/g, '')
    .replace(/\b(Ч|З|Чис|Знам|Л|Лаб|ПрС)\b/gi, '')
    .split(' ')
    .filter(w => w.length > 2)
    .join(' ');

  // Припущення: Перші 2-3 слова - назва предмету. Далі викладач / аудиторія
  const words = cleanText.split(' ');
  const subjectName = words.slice(0, 2).join(' ') || 'Невідомий предмет';
  const teacher = words.slice(2, 3).join(' ') || 'Невідомий';
  const room = words.slice(3).join(' ') || 'Онлайн / Не вказано';

  return {
    id: Math.random().toString(),
    subject_name: subjectName,
    lesson_type: lessonType,
    teacher: teacher,
    room_or_link: room.length > 20 ? room.substring(0, 20) + '...' : room,
    start_time: startTime,
    end_time: endTime,
    day_of_week: dayOfWeek,
    week_type: weekType
  };
};
