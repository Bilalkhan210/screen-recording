import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { HomeScreen } from './screens/HomeScreen';
import { RecordingsScreen } from './screens/RecordingsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { RecordingSettings } from './types';

type Screen = 'home' | 'recordings' | 'settings';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [recordingSettings, setRecordingSettings] = useState<RecordingSettings>({
    resolution: '1080p',
    fps: 60,
    bitrate: '8Mbps',
    recordAudio: true,
    countdownSeconds: 3,
  });

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(splashTimer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
      {showSplash ? (
        <View style={styles.splash}>
          <View style={styles.splashIcon}>
            <View style={styles.recordingDot} />
          </View>
          <Text style={styles.splashTitle}>Screen Recorder</Text>
          <Text style={styles.splashSubtitle}>Preparing your recording studio...</Text>
        </View>
      ) : currentScreen === 'home' ? (
        <HomeScreen
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(mode => !mode)}
          onNavigateToSettings={() => setCurrentScreen('settings')}
          onNavigateToRecordings={() => setCurrentScreen('recordings')}
          settings={recordingSettings}
        />
      ) : currentScreen === 'recordings' ? (
        <RecordingsScreen onBack={() => setCurrentScreen('home')} />
      ) : (
        <SettingsScreen
          isDarkMode={isDarkMode}
          onBack={() => setCurrentScreen('home')}
          settings={recordingSettings}
          onSettingsChange={setRecordingSettings}
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
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F19',
  },
  splashIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B151D',
    borderWidth: 1,
    borderColor: '#7F2939',
  },
  recordingDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
  },
  splashTitle: {
    marginTop: 24,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  splashSubtitle: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 14,
  },
});
