export type WeekType = 'ALL' | 'NUMERATOR' | 'DENOMINATOR';

export interface Lesson {
  id: string;
  subject_name: string;
  lesson_type: string; // Лекція, Лабораторна, Практика, Екзамен (+ опційно ' • 1 півпара' / ' • 2 півпара')
  teacher: string;
  room_or_link: string;
  start_time: string; // format: HH:mm
  end_time: string; // format: HH:mm
  day_of_week: number; // 1-7 (Monday-Sunday)
  subgroup?: string;
  week_type: WeekType;
  exam_date?: string | null; // 'DD.MM.YYYY' — лише для екзаменів, null для звичайних пар
}
