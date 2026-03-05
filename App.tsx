import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { initDb } from './src/db/database';

export default function App() {
  useEffect(() => {
    // Ініціалізуємо БД при старті додатка
    initDb()
      .then(() => console.log('Database initialized successfully'))
      .catch(error => console.error('Database initialization failed', error));
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
