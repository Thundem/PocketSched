import { Share } from 'react-native';
import { getAllLessons, clearAllLessons, insertLesson } from '../db/database';
import { getProfile } from './settings';
import { Lesson } from '../db/schema';

const EXPORT_VERSION = 1;

interface ExportFile {
  version: number;
  exportedAt: string;
  profile: { name: string; emoji: string };
  lessons: Lesson[];
}

export const exportSchedule = async (): Promise<void> => {
  const [lessons, profile] = await Promise.all([getAllLessons(), getProfile()]);
  const payload: ExportFile = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    lessons,
  };
  const json = JSON.stringify(payload);
  const result = await Share.share({ message: json, title: 'Розклад PocketSched' });
  if (result.action === Share.dismissedAction) {
    throw new Error('CANCELLED');
  }
};

export const importScheduleFromText = async (text: string): Promise<{ imported: number; profileName: string }> => {
  let data: ExportFile;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error('Текст не є розкладом PocketSched — перевірте, чи скопіювали повністю');
  }

  if (!Array.isArray(data.lessons)) {
    throw new Error('Файл не містить уроків');
  }

  await clearAllLessons();
  for (const lesson of data.lessons) {
    await insertLesson(lesson);
  }

  return {
    imported: data.lessons.length,
    profileName: data.profile?.name ?? '',
  };
};
