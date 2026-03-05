import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

import ScheduleTabs from './ScheduleNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import AddLessonScreen from '../screens/AddLessonScreen';
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
        options={({ navigation }) => ({
          title: 'Мій розклад',
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('AddLesson')} style={{ marginRight: 15 }}>
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen 
        name="AddLesson" 
        component={AddLessonScreen} 
        options={{ title: 'Додати пару', presentation: 'modal' }} 
      />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer theme={MyTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false, // Ховаємо хедер тут, бо він є у стеку
          tabBarStyle: { paddingBottom: 5, backgroundColor: colors.surface, borderTopColor: colors.separator },
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
        })}
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

