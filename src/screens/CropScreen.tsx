import React, { useState, useRef, useMemo } from 'react';
import {
  View, Image, StyleSheet, TouchableOpacity, Text,
  PanResponder, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { processScheduleImage } from '../services/ocrScanner';
import { useScheduleStore } from '../stores/ScheduleContext';
import { colors } from '../theme/colors';

const { width: SW, height: SH } = Dimensions.get('window');
const HEADER_H  = 56;   // висота верхнього хедера (без інсетів)
const FOOTER_H  = 90;   // висота нижньої панелі з кнопками
const CONTAINER_W = SW;
const HANDLE = 32;             // розмір ручки
const MIN_CROP = 0.06;         // мінімальний розмір кадру (6%)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function CropScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { imageUri, targetDay } = route.params;
  const insets = useSafeAreaInsets();

  // Висота контейнера зображення з урахуванням статус-бару
  const CONTAINER_H = SH - HEADER_H - FOOTER_H - insets.top;

  const [isLoading, setIsLoading] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  // Координати рамки кадрування: частки від 0 до 1 відносно реального зображення
  const cropRef = useRef({ left: 0, top: 0, right: 1, bottom: 1 });
  const [crop, setCrop] = useState({ left: 0, top: 0, right: 1, bottom: 1 });

  // Реальний прямокутник зображення у контейнері (враховує letterbox від contain)
  const imgRectRef = useRef({ x: 0, y: 0, w: CONTAINER_W, h: CONTAINER_H });
  const imgRect = useMemo(() => {
    const scale = Math.min(CONTAINER_W / naturalSize.w, CONTAINER_H / naturalSize.h);
    const rW = naturalSize.w * scale;
    const rH = naturalSize.h * scale;
    const rect = { x: (CONTAINER_W - rW) / 2, y: (CONTAINER_H - rH) / 2, w: rW, h: rH };
    imgRectRef.current = rect;
    return rect;
  }, [naturalSize]);

  // Абсолютні пікселі рамки на екрані
  const box = {
    left:   imgRect.x + crop.left   * imgRect.w,
    top:    imgRect.y + crop.top    * imgRect.h,
    right:  imgRect.x + crop.right  * imgRect.w,
    bottom: imgRect.y + crop.bottom * imgRect.h,
  };

  // Фабрика panResponder для кожної сторони/кута
  const makePan = (
    sides: Array<'left' | 'right' | 'top' | 'bottom'>
  ) => {
    let start = { left: 0, top: 0, right: 1, bottom: 1 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start = { ...cropRef.current }; },
      onPanResponderMove: (_, { dx, dy }) => {
        const { w: iW, h: iH } = imgRectRef.current;
        const c = { ...start };
        if (sides.includes('left'))   c.left   = clamp(start.left   + dx / iW, 0,            start.right  - MIN_CROP);
        if (sides.includes('right'))  c.right  = clamp(start.right  + dx / iW, start.left  + MIN_CROP, 1);
        if (sides.includes('top'))    c.top    = clamp(start.top    + dy / iH, 0,            start.bottom - MIN_CROP);
        if (sides.includes('bottom')) c.bottom = clamp(start.bottom + dy / iH, start.top   + MIN_CROP, 1);
        cropRef.current = c;
        setCrop({ ...c });
      },
    });
  };

  // Ручки для сторін і кутів (створюємо один раз через useRef)
  const panL  = useRef(makePan(['left'])).current;
  const panR  = useRef(makePan(['right'])).current;
  const panT  = useRef(makePan(['top'])).current;
  const panB  = useRef(makePan(['bottom'])).current;
  const panTL = useRef(makePan(['top', 'left'])).current;
  const panTR = useRef(makePan(['top', 'right'])).current;
  const panBL = useRef(makePan(['bottom', 'left'])).current;
  const panBR = useRef(makePan(['bottom', 'right'])).current;

  const { refresh } = useScheduleStore();

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const result = await processScheduleImage(imageUri, targetDay);
      const dayNames: Record<number, string> = {
        1: 'Понеділок', 2: 'Вівторок', 3: 'Середа',
        4: 'Четвер', 5: "П'ятниця", 6: 'Субота', 7: 'Неділя',
      };
      const savedDay = result.length > 0 ? result[0].day_of_week : targetDay;
      const dayLabel = dayNames[savedDay] ?? `День ${savedDay}`;
      Alert.alert(
        'Успіх!',
        `Знайдено ${result.length} пар (день: ${dayLabel}).\nПерейдіть на вкладку цього дня, щоб побачити розклад.`,
      );
      await refresh();
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Помилка OCR', 'Не вдалося розпізнати розклад з цього фото.');
    } finally {
      setIsLoading(false);
    }
  };

  const midX = (box.left + box.right)  / 2;
  const midY = (box.top  + box.bottom) / 2;

  return (
    <View style={styles.container}>
      {/* ─── Верхній хедер ─── */}
      <View style={[styles.header, { paddingTop: insets.top, height: HEADER_H + insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color="#fff" />
          <Text style={styles.headerBtnText}>Скасувати</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Кадрування</Text>
        <View style={{ width: 100 }} />
      </View>

      {/* ─── Зображення + overlay ─── */}
      <View style={{ width: CONTAINER_W, height: CONTAINER_H }}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: CONTAINER_W, height: CONTAINER_H }}
          resizeMode="contain"
          onLoad={({ nativeEvent: { source } }) =>
            setNaturalSize({ w: source.width, h: source.height })
          }
        />

        {/* Затемнення поза рамкою — 4 смуги */}
        <View style={[styles.overlay, { top: 0,          left: 0,         right: 0,       height: box.top }]} />
        <View style={[styles.overlay, { top: box.bottom, left: 0,         right: 0,       bottom: 0 }]} />
        <View style={[styles.overlay, { top: box.top,    left: 0,         width: box.left, height: box.bottom - box.top }]} />
        <View style={[styles.overlay, { top: box.top,    left: box.right, right: 0,       height: box.bottom - box.top }]} />

        {/* Рамка кадрування */}
        <View style={[styles.cropBorder, {
          position: 'absolute',
          left: box.left, top: box.top,
          width: box.right - box.left,
          height: box.bottom - box.top,
        }]} />

        {/* Сітка третин всередині рамки */}
        {[1/3, 2/3].map(f => (
          <React.Fragment key={f}>
            <View style={[styles.gridLine, {
              position: 'absolute',
              left: box.left + f * (box.right - box.left),
              top: box.top, width: 1, height: box.bottom - box.top,
            }]} />
            <View style={[styles.gridLine, {
              position: 'absolute',
              top: box.top + f * (box.bottom - box.top),
              left: box.left, height: 1, width: box.right - box.left,
            }]} />
          </React.Fragment>
        ))}

        {/* ── Ручки сторін ── */}
        <View {...panT.panHandlers}  style={[styles.hEdge, styles.hHoriz, { left: midX - 22, top:  box.top    - 5 }]} />
        <View {...panB.panHandlers}  style={[styles.hEdge, styles.hHoriz, { left: midX - 22, top:  box.bottom - 5 }]} />
        <View {...panL.panHandlers}  style={[styles.hEdge, styles.hVert,  { top:  midY - 22, left: box.left   - 5 }]} />
        <View {...panR.panHandlers}  style={[styles.hEdge, styles.hVert,  { top:  midY - 22, left: box.right  - 5 }]} />

        {/* ── Кутові ручки ── */}
        <View {...panTL.panHandlers} style={[styles.hCorner, { top: box.top    - 1, left: box.left  - 1 }]} />
        <View {...panTR.panHandlers} style={[styles.hCorner, { top: box.top    - 1, left: box.right - HANDLE + 1 }]} />
        <View {...panBL.panHandlers} style={[styles.hCorner, { top: box.bottom - HANDLE + 1, left: box.left - 1 }]} />
        <View {...panBR.panHandlers} style={[styles.hCorner, { top: box.bottom - HANDLE + 1, left: box.right - HANDLE + 1 }]} />
      </View>

      {/* ─── Кнопка сканування (знизу) ─── */}
      <View style={styles.controls}>
        {isLoading
          ? <ActivityIndicator size="large" color={colors.primary} />
          : (
            <TouchableOpacity style={styles.btnConfirm} onPress={handleConfirm}>
              <Ionicons name="scan-outline" size={22} color="#fff" />
              <Text style={styles.btnText}>Сканувати</Text>
            </TouchableOpacity>
          )
        }
      </View>
    </View>
  );
}

const BORDER_COLOR = '#FFD700';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  cropBorder: {
    borderWidth: 2,
    borderColor: BORDER_COLOR,
  },
  gridLine: {
    backgroundColor: 'rgba(255,215,0,0.3)',
  },
  // Ручка на середині кожної сторони (видовжена смужка)
  hEdge: {
    position: 'absolute',
    backgroundColor: BORDER_COLOR,
    borderRadius: 4,
  },
  hHoriz: { width: 44, height: 10 },
  hVert:  { width: 10, height: 44 },
  // Кутова ручка (квадратик з заокругленням лише зовні)
  hCorner: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderColor: BORDER_COLOR,
    borderWidth: 4,
    backgroundColor: 'transparent',
  },
  controls: {
    height: FOOTER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnCancel: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#444',
    borderRadius: 14,
    paddingHorizontal: 22, paddingVertical: 13,
  },
  btnConfirm: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 22, paddingVertical: 13,
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
