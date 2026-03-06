import * as FileSystem from 'expo-file-system/legacy';

const SETTINGS_FILE = `${FileSystem.documentDirectory}settings.json`;

export type WeekTypeSetting = 'numerator' | 'denominator';
export type HiddenSubgroup  = '1' | '2' | null;

export interface Profile {
  name: string;
  emoji: string;
}

interface Settings {
  weekType: WeekTypeSetting;
  hiddenSubgroup: HiddenSubgroup;
  profile: Profile;
}

const DEFAULT: Settings = {
  weekType: 'numerator',
  hiddenSubgroup: null,
  profile: { name: '', emoji: '🎓' },
};

const readAll = async (): Promise<Settings> => {
  try {
    const info = await FileSystem.getInfoAsync(SETTINGS_FILE);
    if (!info.exists) return { ...DEFAULT };
    const raw = await FileSystem.readAsStringAsync(SETTINGS_FILE);
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
};

const writeAll = async (s: Settings): Promise<void> => {
  await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify(s));
};

// ── Тип тижня ──────────────────────────────────────────────────────────────
export const getWeekType = async (): Promise<WeekTypeSetting> => {
  const s = await readAll();
  return s.weekType;
};

export const setWeekType = async (v: WeekTypeSetting): Promise<void> => {
  const s = await readAll();
  await writeAll({ ...s, weekType: v });
};

// ── Прихована підгрупа ─────────────────────────────────────────────────────
export const getHiddenSubgroup = async (): Promise<HiddenSubgroup> => {
  const s = await readAll();
  return s.hiddenSubgroup;
};

export const setHiddenSubgroup = async (v: HiddenSubgroup): Promise<void> => {
  const s = await readAll();
  await writeAll({ ...s, hiddenSubgroup: v });
};

// ── Профіль ────────────────────────────────────────────────────────────────
export const getProfile = async (): Promise<Profile> => {
  const s = await readAll();
  return s.profile ?? DEFAULT.profile;
};

export const setProfile = async (v: Partial<Profile>): Promise<void> => {
  const s = await readAll();
  await writeAll({ ...s, profile: { ...(s.profile ?? DEFAULT.profile), ...v } });
};
