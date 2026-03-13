import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Lesson, LessonOverride } from '../db/schema';
import { getAllLessons, getOverridesForWeek } from '../db/database';
import { getHiddenSubgroup, HiddenSubgroup } from '../services/settings';

/** 3-week window starting from current Monday (covers this week + next 2) */
function getWindowDates(): string[] {
  const today = new Date();
  const dow = today.getDay() === 0 ? 7 : today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow - 1));
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  return Array.from({ length: 21 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return fmt(d);
  });
}

interface ScheduleStore {
  lessons: Lesson[];
  overrides: LessonOverride[];
  hiddenSubgroup: HiddenSubgroup;
  isReady: boolean;
  /** Re-reads everything from DB; call after any mutation. */
  refresh: () => Promise<void>;
}

const ScheduleContext = createContext<ScheduleStore>({
  lessons: [],
  overrides: [],
  hiddenSubgroup: null,
  isReady: false,
  refresh: async () => {},
});

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [overrides, setOverrides] = useState<LessonOverride[]>([]);
  const [hiddenSubgroup, setHiddenSubgroup] = useState<HiddenSubgroup>(null);
  const [isReady, setIsReady] = useState(false);

  const refresh = useCallback(async () => {
    const [lessonData, overrideData, hiddenSub] = await Promise.all([
      getAllLessons(),
      getOverridesForWeek(getWindowDates()),
      getHiddenSubgroup(),
    ]);
    setLessons(lessonData);
    setOverrides(overrideData);
    setHiddenSubgroup(hiddenSub);
    setIsReady(true);
  }, []);

  // Load once at startup — all screens share this data
  useEffect(() => { refresh(); }, []);

  return (
    <ScheduleContext.Provider value={{ lessons, overrides, hiddenSubgroup, isReady, refresh }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export const useScheduleStore = () => useContext(ScheduleContext);
