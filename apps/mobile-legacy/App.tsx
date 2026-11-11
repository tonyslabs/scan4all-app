// src/App.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Home from "./src/screens/Home";
import Review from "./src/screens/Review";

export type RootStackParamList = {
  Home: undefined;
  Review: { kind: "file" | "url"; uri: string; name: string; mime: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Review" component={Review} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
