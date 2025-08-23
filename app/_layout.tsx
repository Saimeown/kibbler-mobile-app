import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAWs_lSL0Z09pYVQ70lvxEaqQl6YSsE6tY",
  projectId: "kibbler-24518",
  appId: "1:1093837743559:web:3d4a3a0a1f4e3f5c1a2f1f",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const RootLayout = () => {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const userRef = ref(database, 'users/current_user');
    get(userRef).then((snapshot) => {
      const userData = snapshot.val();
      const isInTabs = segments[0] === '(tabs)';
      if (userData?.isLoggedIn && !isInTabs) {
        router.replace('/(tabs)');
      } else if (!userData?.isLoggedIn && isInTabs) {
        router.replace('/login');
      }
    }).catch((error) => {
      console.error('Error checking login state:', error);
    });
  }, [router, segments]);

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
};

export default RootLayout;