import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import DashboardScreen from "./screens/DashboardScreen";
import NodeDetailScreen from "./screens/NodeDetailScreen";

export type RootStackParamList = {
  Dashboard: undefined;
  NodeDetail: { nodeId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Dashboard">
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "XDCNet Nodes" }}
        />
        <Stack.Screen
          name="NodeDetail"
          component={NodeDetailScreen}
          options={{ title: "Node Details" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
