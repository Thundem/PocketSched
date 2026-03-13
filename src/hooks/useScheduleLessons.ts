import { useState, useMemo, useCallback, useEffect } from 'react';
import { Lesson } from '../db/schema';
import { updateSortOrders } from '../db/database';
import { TimeEngine } from '../services/timeEngine';
import { useScheduleStore } from '../stores/ScheduleContext';

const timeEngine = new TimeEngine();

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * Pure in-memory filter over the global ScheduleStore.
 * No DB calls, no useFocusEffect — data is always ready from the store,
 * so switching tabs is instant with zero re-renders or spinners.
 */
export function useScheduleLessons(isTomorrow: boolean) {
  const { lessons: allLessons, overrides, hiddenSubgroup, isReady, refresh } = useScheduleStore();
  const [activeLessonId, setActiveLessonId] = useState('');

  const targetDate = new Date();
  if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1);
  const targetDayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
  const dateStr = formatDate(targetDate);

  const lessons = useMemo(() => {
    if (!isReady) return [];
    const weekFilter = timeEngine.getCurrentWeekType(targetDate);
    const movedAwayIds = new Set(
      overrides.filter(o => o.original_date === dateStr).map(o => o.lesson_id),
    );
    const movedHereMap = new Map(
      overrides.filter(o => o.new_day_of_week === targetDayOfWeek).map(o => [o.lesson_id, o]),
    );
    const result = allLessons
      .filter(l => {
        if (movedAwayIds.has(l.id)) return false;
        if (l.exam_date) return l.exam_date === dateStr;
        if (movedHereMap.has(l.id)) return !hiddenSubgroup || l.subgroup !== hiddenSubgroup;
        return (
          l.day_of_week === targetDayOfWeek &&
          (l.week_type === 'ALL' || l.week_type === weekFilter) &&
          (!hiddenSubgroup || l.subgroup !== hiddenSubgroup)
        );
      })
      .map(l => {
        const ov = movedHereMap.get(l.id);
        if (!ov) return l;
        return { ...l, start_time: ov.new_start_time ?? l.start_time, end_time: ov.new_end_time ?? l.end_time };
      });
    result.sort((a, b) => {
      const sa = a.sort_order ?? Infinity, sb = b.sort_order ?? Infinity;
      return sa !== sb ? sa - sb : a.start_time.localeCompare(b.start_time);
    });
    return result;
  }, [allLessons, overrides, hiddenSubgroup, isReady, isTomorrow]);

  // Update active-lesson indicator every minute while mounted
  useEffect(() => {
    if (isTomorrow || lessons.length === 0) { setActiveLessonId(''); return; }
    const update = () => {
      const active = timeEngine.getActiveLesson(lessons);
      setActiveLessonId(active?.id ?? '');
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [lessons, isTomorrow]);

  const handleDragEnd = useCallback(
    async ({ data }: { data: Lesson[] }) => {
      const updates = data.map((l, i) => ({ id: l.id, sort_order: i * 10 }));
      await updateSortOrders(updates);
      await refresh();
    },
    [refresh],
  );

  return { lessons, isLoading: !isReady, activeLessonId, refresh, handleDragEnd, dateStr };
}
