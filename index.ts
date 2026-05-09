import messaging from '@react-native-firebase/messaging';
import { registerRootComponent } from 'expo';

import App from './App';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (__DEV__) {
    console.log('[FCM] Background message:', remoteMessage?.messageId);
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
