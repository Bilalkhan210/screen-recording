import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { HomeScreen } from './screens/HomeScreen';
import { RecordingsScreen } from './screens/RecordingsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Screen = 'home' | 'recordings' | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isDarkMode, setIsDarkMode] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0B0F19' : '#FFFFFF'}
      />
      {currentScreen === 'home' && (
        <HomeScreen
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(mode => !mode)}
          onNavigateToSettings={() => setCurrentScreen('settings')}
        />
      )}
      {currentScreen === 'recordings' && (
        <RecordingsScreen onBack={() => setCurrentScreen('home')} />
      )}
      {currentScreen === 'settings' && (
        <SettingsScreen
          isDarkMode={isDarkMode}
          onBack={() => setCurrentScreen('home')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
});
