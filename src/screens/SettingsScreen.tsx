import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Modal, FlatList,
} from 'react-native';
import { colors } from '../theme/colors';
import {
  getHiddenSubgroup, setHiddenSubgroup, HiddenSubgroup,
  getProfile, setProfile,
} from '../services/settings';
import { TimeEngine } from '../services/timeEngine';
import { exportSchedule, importScheduleFromFile, importScheduleFromText } from '../services/shareSchedule';

const timeEngine = new TimeEngine();

const EMOJI_OPTIONS = [
  '🎓','📚','💡','🧠','🏫','✏️','📝','🧑‍💻','👨‍🏫','👩‍🏫',
  '🔬','🔭','📐','📏','🖊️','📖','🎒','💻','🏆','⭐',
];

export default function SettingsScreen() {
  const [autoWeekType, setAutoWeekType] = useState<'NUMERATOR' | 'DENOMINATOR'>('NUMERATOR');
  const [hiddenSub, setHiddenSubState] = useState<HiddenSubgroup>(null);
  const [profileName, setProfileNameState] = useState('');
  const [profileEmoji, setProfileEmojiState] = useState('🎓');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    const wt = timeEngine.getCurrentWeekType();
    setAutoWeekType(wt === 'ALL' ? 'NUMERATOR' : wt);
    getHiddenSubgroup().then(setHiddenSubState);
    getProfile().then(p => {
      setProfileNameState(p.name);
      setProfileEmojiState(p.emoji);
    });
  }, []);

  const handleHiddenSub = (val: HiddenSubgroup) => {
    const next = hiddenSub === val ? null : val;
    setHiddenSubState(next);
    setHiddenSubgroup(next);
  };

  const handleNameBlur = () => {
    setProfile({ name: profileName.trim() });
  };

  const handleEmojiSelect = (emoji: string) => {
    setProfileEmojiState(emoji);
    setProfile({ emoji });
    setEmojiPickerVisible(false);
  };

  const handleExport = async () => {
    setSharing(true);
    try {
      await exportSchedule();
    } catch (e: any) {
      Alert.alert('Помилка', e?.message ?? 'Не вдалося поділитися розкладом');
    } finally {
      setSharing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const { imported, profileName: senderName } = await importScheduleFromFile();
      const from = senderName ? ` від ${senderName}` : '';
      Alert.alert('Готово', `Імпортовано ${imported} пар${from}`);
    } catch (e: any) {
      if (e?.message === 'NO_PICKER') {
        // Expo Go: пікер недоступний — відкриваємо модалку з полем вводу
        setImportText('');
        setImportModalVisible(true);
      } else if (e?.message !== 'CANCELLED') {
        Alert.alert('Помилка', e?.message ?? 'Не вдалося імпортувати розклад');
      }
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const { imported, profileName: senderName } = await importScheduleFromText(importText);
      setImportModalVisible(false);
      setImportText('');
      const from = senderName ? ` від ${senderName}` : '';
      Alert.alert('Готово', `Імпортовано ${imported} пар${from}`);
    } catch (e: any) {
      Alert.alert('Помилка', e?.message ?? 'Не вдалось імпортувати розклад');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <Text style={styles.header}>Налаштування</Text>

      {/* ── Профіль ── */}
      <Text style={styles.sectionLabel}>ПРОФІЛЬ</Text>
      <View style={styles.profileCard}>
        <TouchableOpacity style={styles.avatarBtn} onPress={() => setEmojiPickerVisible(true)}>
          <Text style={styles.avatarEmoji}>{profileEmoji}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.nameInput}
          value={profileName}
          onChangeText={setProfileNameState}
          onBlur={handleNameBlur}
          placeholder="Ім'я або прізвище"
          placeholderTextColor={colors.inactive}
          returnKeyType="done"
          maxLength={40}
        />
      </View>

      {/* ── Обмін розкладом ── */}
      <Text style={styles.sectionLabel}>ОБМІН РОЗКЛАДОМ</Text>
      <View style={styles.settingBlock}>
        <Text style={styles.settingDesc}>
          Надсилайте та отримуйте розклад через будь-який месенджер або електронну пошту
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, sharing && styles.actionBtnDisabled]}
          onPress={handleExport}
          disabled={sharing}
        >
          <Text style={styles.actionBtnText}>
            {sharing ? 'Підготовка файлу…' : '📤  Поділитися розкладом'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary, importing && styles.actionBtnDisabled]}
          onPress={handleImport}
          disabled={importing}
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
            {importing ? 'Імпортування…' : '📥  Отримати розклад'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Тип тижня (авто) ── */}
      <Text style={styles.sectionLabel}>ТИЖДЕНЬ</Text>
      <View style={styles.settingBlock}>
        <Text style={styles.settingTitle}>Поточний тиждень</Text>
        <Text style={styles.settingDesc}>
          Визначено автоматично: {autoWeekType === 'NUMERATOR' ? 'Чисельник (Непарний)' : 'Знаменник (Парний)'}
        </Text>
        <Text style={styles.settingDesc}>
          Вкладка "Тиждень" показує цей тиждень, "Наст. тиждень" — наступний
        </Text>
      </View>

      {/* ── Прихована підгрупа ── */}
      <Text style={styles.sectionLabel}>ПІДГРУПИ</Text>
      <View style={styles.settingBlock}>
        <Text style={styles.settingTitle}>Прихована підгрупа</Text>
        <Text style={styles.settingDesc}>
          Пари обраної підгрупи не відображатимуться в розкладі
        </Text>
        <View style={styles.subgroupRow}>
          {(['1', '2'] as HiddenSubgroup[]).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.subBtn, hiddenSub === v && styles.subBtnActive]}
              onPress={() => handleHiddenSub(v)}
            >
              <Text style={[styles.subBtnText, hiddenSub === v && styles.subBtnTextActive]}>
                Підгр. {v}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.subBtn, hiddenSub === null && styles.subBtnActive]}
            onPress={() => handleHiddenSub(null)}
          >
            <Text style={[styles.subBtnText, hiddenSub === null && styles.subBtnTextActive]}>
              Всі
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Модалка імпорту (Expo Go — немає пікера) ── */}
      <Modal
        visible={importModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setImportModalVisible(false)}
        >
          <View style={styles.importSheet}>
            <Text style={styles.emojiSheetTitle}>Вставте текст розкладу</Text>
            <Text style={styles.settingDesc}>
              Скопіюйте весь JSON-текст, надісланий другом, та вставте сюди
            </Text>
            <TextInput
              style={styles.importInput}
              value={importText}
              onChangeText={setImportText}
              placeholder='{"version":1, "lessons":[...]}'
              placeholderTextColor={colors.inactive}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary, { flex: 1 }]}
                onPress={() => setImportModalVisible(false)}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1 }, (!importText.trim() || importing) && styles.actionBtnDisabled]}
                onPress={confirmImport}
                disabled={!importText.trim() || importing}
              >
                <Text style={styles.actionBtnText}>{importing ? 'Імпорт…' : 'Імпортувати'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Emoji picker modal ── */}
      <Modal
        visible={emojiPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmojiPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEmojiPickerVisible(false)}
        >
          <View style={styles.emojiSheet}>
            <Text style={styles.emojiSheetTitle}>Оберіть іконку</Text>
            <FlatList
              data={EMOJI_OPTIONS}
              numColumns={5}
              keyExtractor={item => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.emojiItem,
                    item === profileEmoji && styles.emojiItemActive,
                  ]}
                  onPress={() => handleEmojiSelect(item)}
                >
                  <Text style={styles.emojiItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    color: colors.onBackground,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionLabel: {
    color: colors.inactive,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 14,
  },
  avatarBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarEmoji: {
    fontSize: 30,
  },
  nameInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  settingBlock: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 4,
  },
  settingTitle: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: '600',
  },
  settingDesc: {
    color: colors.inactive,
    fontSize: 14,
  },
  subgroupRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  subBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inactive,
    backgroundColor: colors.surface,
  },
  subBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryVariant,
  },
  subBtnText: {
    color: colors.inactive,
    fontSize: 15,
    fontWeight: '600',
  },
  subBtnTextActive: {
    color: colors.primary,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBtnTextSecondary: {
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  emojiSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
  },
  emojiSheetTitle: {
    color: colors.inactive,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
    textAlign: 'center',
  },
  emojiItem: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  emojiItemActive: {
    backgroundColor: colors.primaryVariant,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  emojiItemText: {
    fontSize: 30,
  },
  importSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
  },
  importInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    color: colors.onSurface,
    fontSize: 13,
    minHeight: 120,
    maxHeight: 260,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
});
