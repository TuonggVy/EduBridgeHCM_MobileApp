import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PushNotificationRuntime } from './src/components/PushNotificationRuntime';
import { ToastProvider } from './src/components/AppToast';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';

GoogleSignin.configure({
  webClientId:
    '552134784046-epckgrmjkr7jql057ednt7tes48qblfo.apps.googleusercontent.com',
  iosClientId:
    '552134784046-48l3bhbcdqo2mp8c7te1q53f4feri00o.apps.googleusercontent.com',
});

function AppContent({
  authView,
  setAuthView,
}: {
  authView: 'login' | 'register';
  setAuthView: (v: 'login' | 'register') => void;
}) {
  const { user } = useAuth();

  if (user) {
    return (
      <>
        <HomeScreen />
        <StatusBar style="light" />
      </>
    );
  }
  return (
    <>
      {authView === 'login' ? (
        <LoginScreen onGoToRegister={() => setAuthView('register')} />
      ) : (
        <RegisterScreen onGoToLogin={() => setAuthView('login')} />
      )}
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  return (
    <ToastProvider>
      <AuthProvider onRegisterSuccess={() => setAuthView('login')}>
        <PushNotificationRuntime />
        <AppContent authView={authView} setAuthView={setAuthView} />
      </AuthProvider>
    </ToastProvider>
  );
}
