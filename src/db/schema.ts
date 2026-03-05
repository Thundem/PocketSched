export type WeekType = 'ALL' | 'NUMERATOR' | 'DENOMINATOR';

export interface Lesson {
  id: string;
  subject_name: string;
  lesson_type: string; // Л, Лаб, ПрС
  teacher: string;
  room_or_link: string;
  start_time: string; // format: HH:mm
  end_time: string; // format: HH:mm
  day_of_week: number; // 1-7 (Monday-Sunday)
  subgroup?: string;
  week_type: WeekType;
}
