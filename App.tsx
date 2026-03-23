import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider } from './src/components/AppToast';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';

GoogleSignin.configure({
  webClientId:
    '655929399159-abrmr7tl7oob6coek02f4i9g2jrtj9rd.apps.googleusercontent.com',
  iosClientId:
    '655929399159-kt2nf9h0qjj3dcnm2ue6opjmtac3rl8l.apps.googleusercontent.com',
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
        <AppContent authView={authView} setAuthView={setAuthView} />
      </AuthProvider>
    </ToastProvider>
  );
}
