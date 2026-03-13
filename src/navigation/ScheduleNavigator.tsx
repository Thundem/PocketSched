import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import DayScheduleScreen from '../screens/DayScheduleScreen';
import WeekScreen from '../screens/WeekScreen';
import { colors } from '../theme/colors';

const TopTab = createMaterialTopTabNavigator();

export default function ScheduleTabs() {
  return (
    <TopTab.Navigator
      screenOptions={{
        lazy: true,
        tabBarStyle: { backgroundColor: colors.surface },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarIndicatorStyle: { backgroundColor: colors.primary },
        tabBarLabelStyle: { fontWeight: 'bold' }
      }}
    >
      <TopTab.Screen name="Today" component={DayScheduleScreen} options={{ tabBarLabel: 'Сьогодні' }} />
      <TopTab.Screen name="Tomorrow" component={DayScheduleScreen} options={{ tabBarLabel: 'Завтра' }} />
      <TopTab.Screen name="Week" component={WeekScreen} options={{ tabBarLabel: 'Тиждень' }} />
      <TopTab.Screen name="NextWeek" component={WeekScreen} options={{ tabBarLabel: 'Наст. тиждень' }} />
    </TopTab.Navigator>
  );
}
