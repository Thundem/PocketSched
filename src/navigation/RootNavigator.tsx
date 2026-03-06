import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, Alert, Modal, Text, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import ScheduleTabs from './ScheduleNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import AddLessonScreen from '../screens/AddLessonScreen';
import CropScreen from '../screens/CropScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MyTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.onSurface,
    primary: colors.primary,
  },
};

const DAY_LABELS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];

// Кнопки хедера зі своїм станом для вибору дня
function ScanHeaderButtons({ route, navigation }: { route: any; navigation: any }) {
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  const focusedTab = getFocusedRouteNameFromRoute(route) ?? 'Today';

  const handleScan = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Помилка', 'Для сканування розкладу потрібен доступ до фото.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      if (focusedTab === 'Week' || focusedTab === 'NextWeek') {
        setPendingImageUri(uri);
        setDayPickerVisible(true);
      } else {
        const now = new Date();
        if (focusedTab === 'Tomorrow') now.setDate(now.getDate() + 1);
        const dayNum = now.getDay() === 0 ? 7 : now.getDay();
        navigation.navigate('CropScreen', { imageUri: uri, targetDay: dayNum });
      }
    }
  };

  const confirmDay = (dayIndex: number) => {
    setDayPickerVisible(false);
    if (pendingImageUri) {
      navigation.navigate('CropScreen', { imageUri: pendingImageUri, targetDay: dayIndex + 1 });
      setPendingImageUri(null);
    }
  };

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 4, marginRight: 12, alignItems: 'center' }}>
        <TouchableOpacity onPress={handleScan} style={{ padding: 4 }}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('AddLesson')} style={{ padding: 4 }}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={dayPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPickerVisible(false)}
      >
        <TouchableOpacity
          style={hdStyles.overlay}
          activeOpacity={1}
          onPress={() => setDayPickerVisible(false)}
        >
          <View style={hdStyles.sheet}>
            <Text style={hdStyles.sheetTitle}>Оберіть день тижня</Text>
            {DAY_LABELS.map((label, i) => (
              <TouchableOpacity key={i} style={hdStyles.dayRow} onPress={() => confirmDay(i)}>
                <Text style={hdStyles.dayRowText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={hdStyles.cancelRow} onPress={() => setDayPickerVisible(false)}>
              <Text style={hdStyles.cancelText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const hdStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  sheetTitle: {
    color: colors.inactive,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dayRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  dayRowText: {
    color: colors.onSurface,
    fontSize: 17,
    paddingHorizontal: 4,
  },
  cancelRow: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '600',
  },
});

// Стек для розкладу (включає таби та екран додавання/редагування)
function ScheduleStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { fontWeight: 'bold' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="ScheduleTabs"
        component={ScheduleTabs}
        options={({ navigation, route }) => ({
          title: 'Мій розклад',
          headerRight: () => <ScanHeaderButtons route={route} navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="AddLesson"
        component={AddLessonScreen}
        options={{ title: 'Додати пару', presentation: 'modal' }}
      />
      <Stack.Screen
        name="CropScreen"
        component={CropScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer theme={MyTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => {
          const focusedRoute = getFocusedRouteNameFromRoute(route);
          const isOnCropScreen = focusedRoute === 'CropScreen';
          return {
            headerShown: false,
            tabBarStyle: isOnCropScreen
              ? { display: 'none' }
              : { paddingBottom: 5, backgroundColor: colors.surface, borderTopColor: colors.separator },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.inactive,
            tabBarIcon: ({ focused, color, size }) => {
              let iconName = '';

              if (route.name === 'ScheduleStackTab') {
                iconName = focused ? 'calendar' : 'calendar-outline';
              } else if (route.name === 'Settings') {
                iconName = focused ? 'settings' : 'settings-outline';
              }

              return <Ionicons name={iconName as any} size={size} color={color} />;
            },
          };
        }}
      >
        <Tab.Screen 
          name="ScheduleStackTab" 
          component={ScheduleStack} 
          options={{ title: 'Розклад' }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ 
            title: 'Налаштування', 
            headerShown: true, 
            headerStyle: { backgroundColor: colors.surface, borderBottomWidth: 0, elevation: 0 },
            headerTitleStyle: { color: colors.onSurface, fontWeight: 'bold' },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

