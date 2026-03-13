import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';
import { ScheduleProvider } from './src/stores/ScheduleContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ScheduleProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </ScheduleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
