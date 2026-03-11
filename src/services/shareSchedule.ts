import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
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
  const json = JSON.stringify(payload, null, 2);

  // Спробуємо поділитись файлом (потребує dev-білду)
  try {
    const Sharing = await import('expo-sharing');
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    const fileName = `pocketsched_${stamp}.json`;
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.write(json);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Поділитися розкладом PocketSched',
      UTI: 'public.json',
    });
    return;
  } catch (e: any) {
    if (e?.message === 'CANCELLED') return;
    // expo-sharing недоступний (Expo Go) — відкат до текстового Share
  }

  const result = await Share.share({ message: json, title: 'Розклад PocketSched' });
  if (result.action === Share.dismissedAction) {
    throw new Error('CANCELLED');
  }
};

const parseExportFile = async (text: string): Promise<{ imported: number; profileName: string }> => {
  let data: ExportFile;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error('Файл не є розкладом PocketSched');
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

export const importScheduleFromText = async (text: string): Promise<{ imported: number; profileName: string }> =>
  parseExportFile(text);

// Кидає 'NO_PICKER' якщо expo-document-picker недоступний (Expo Go)
export const importScheduleFromFile = async (): Promise<{ imported: number; profileName: string }> => {
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch {
    throw new Error('NO_PICKER');
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    throw new Error('CANCELLED');
  }

  const uri = result.assets[0].uri;
  const text = await new File(uri).text();
  return parseExportFile(text);
};
