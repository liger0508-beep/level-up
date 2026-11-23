import React, { useRef, useState, useEffect } from 'react';
import { BackHandler, SafeAreaView, StatusBar, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const TARGET_URL = 'https://gla-coach.vercel.app/';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (e) {
    console.warn('Expo push token error:', e);
    return null;
  }
}

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);

  const sendTokenToWebView = (token) => {
    if (!token || !webViewRef.current) return;
    const js = `
      window.__EXPO_PUSH_TOKEN__ = ${JSON.stringify(token)};
      window.__EXPO_PLATFORM__ = ${JSON.stringify(Platform.OS)};
      window.dispatchEvent(new CustomEvent('expoPushToken', { detail: { token: ${JSON.stringify(token)}, platform: ${JSON.stringify(Platform.OS)} } }));
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  };

  const navigateWebView = (urlPath) => {
    if (!urlPath) return;
    if (!webViewRef.current) {
      setPendingUrl(urlPath);
      return;
    }
    const fullUrl = urlPath.startsWith('http')
      ? urlPath
      : `${TARGET_URL.replace(/\/$/, '')}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
    webViewRef.current.injectJavaScript(`window.location.href = ${JSON.stringify(fullUrl)}; true;`);
  };

  // 안드로이드 런타임 권한 요청 & 푸시 알림 등록
  useEffect(() => {
    async function initPermissionsAndPush() {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
          if (Platform.Version >= 33 && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
          }
        } catch (err) {
          console.warn('권한 요청 에러:', err);
        }
      }

      const token = await registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
        sendTokenToWebView(token);
      }
    }
    initPermissionsAndPush();

    // 앱이 꺼져 있다가 알림 클릭으로 실행된 경우
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (url) {
        setPendingUrl(url);
      }
    });

    // 앱이 켜져 있거나 백그라운드일 때 알림을 클릭한 경우
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (url) {
        navigateWebView(url);
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  useEffect(() => {
    if (expoPushToken) {
      sendTokenToWebView(expoPushToken);
    }
  }, [expoPushToken]);

  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebView
        ref={webViewRef}
        source={{ uri: TARGET_URL }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        overScrollMode="never"
        keyboardDisplayRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={true}
        userAgent={
          Platform.OS === 'ios'
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        }
        onLoadEnd={() => {
          if (expoPushToken) {
            sendTokenToWebView(expoPushToken);
          }
          if (pendingUrl) {
            const urlToGo = pendingUrl;
            setPendingUrl(null);
            navigateWebView(urlToGo);
          }
        }}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
