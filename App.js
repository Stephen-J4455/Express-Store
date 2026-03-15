import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { SellerProvider, useSeller } from "./src/context/SellerContext";
import { ToastProvider } from "./src/context/ToastContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import CatalogScreen from "./src/screens/CatalogScreen";
import { OrdersScreen } from "./src/screens/OrdersScreen";
import { OrderDetailScreen } from "./src/screens/OrderDetailScreen";
import { SellerChatsScreen } from "./src/screens/SellerChatsScreen";
import { SellerChatScreen } from "./src/screens/SellerChatScreen";
import { StatusCreatorScreen } from "./src/screens/StatusCreatorScreen";
import { FlashSaleScreen } from "./src/screens/FlashSaleScreen";
import SellerLoginScreen from "./src/screens/SellerLoginScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import { colors } from "./src/theme/colors";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { FeedbackScreen } from "./src/screens/FeedbackScreen";
import { LoadingAnimation } from "./src/components/LoadingAnimation";
import { useResponsive } from "./src/hooks/useResponsive";
import { WebSidebar } from "./src/components/WebSidebar";
import React, { useState, useEffect } from "react";

import * as Linking from "expo-linking";

import { useNavigation } from "@react-navigation/native";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// remove the web prefix to prevent automatic app opening for HTTP links
const linking = {
  prefixes: ["expressseller://"],
  config: {
    screens: {
      Login: "login",
      ForgotPassword: "forgot-password",
    },
  },
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.light,
    card: "#fff",
    text: colors.dark,
    primary: colors.primary,
    border: "transparent",
  },
};

const icons = {
  Overview: "speedometer",
  Catalog: "pricetags",
  Orders: "cube",
  Chats: "chatbubble",
  Feedback: "star",
  Profile: "person",
};

const normalizeRole = (role) =>
  typeof role === "string" && role.trim().length ? role.toLowerCase() : null;

const MissingConfig = () => (
  <View style={styles.center}>
    <Ionicons name="cloud-offline-outline" size={64} color={colors.primary} />
    <Text style={[styles.title, { marginTop: 16 }]}>Supabase missing</Text>
    <Text style={styles.subtitle}>
      Open supabase.js and drop in your project URL and anon key.
    </Text>
  </View>
);

const SellerStack = ({ onLogout }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs">
      {(props) => <SellerTabs {...props} onLogout={onLogout} />}
    </Stack.Screen>
    <Stack.Screen name="SellerChat" component={SellerChatScreen} />
    <Stack.Screen name="StatusCreator" component={StatusCreatorScreen} />
    <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    <Stack.Screen name="FlashSale" component={FlashSaleScreen} />
    <Stack.Screen
      name="PaystackSetup"
      component={require("./src/screens/PaystackSetupScreen").default}
    />
  </Stack.Navigator>
);
const SellerTabs = ({ onLogout }) => {
  const { metrics, profile } = useSeller();
  const { getTheme, colors: themeColors } = require("./src/theme/colors");
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || themeColors.primary)
    : getTheme(themeColors.primary);
  const { isWide, sidebarWidth } = useResponsive();
  // Sidebar only on wide web viewports — native mobile always uses bottom nav
  const showSidebar = Platform.OS === "web" && isWide;
  const orderBadge =
    metrics.inProgressOrders > 0
      ? metrics.inProgressOrders > 99
        ? "99+"
        : String(metrics.inProgressOrders)
      : undefined;

  return (
    <Tab.Navigator
      sceneContainerStyle={
        showSidebar ? styles.scene : styles.sceneWithFloatingTab
      }
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarPosition: showSidebar ? "left" : "bottom",
        tabBarStyle: showSidebar
          ? { width: sidebarWidth, borderRightWidth: 0 }
          : {},
        tabBarItemStyle: styles.tabBarItem,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={icons[route.name] || "ellipse"}
            size={size}
            color={color}
          />
        ),
        tabBarBadge: route.name === "Orders" ? orderBadge : undefined,
        tabBarBadgeStyle: [styles.badge, { backgroundColor: theme.accent }],
      })}
      tabBar={(props) =>
        showSidebar ? (
          <WebSidebar {...props} sidebarWidth={sidebarWidth} />
        ) : (
          <DefaultSellerTabBar
            {...props}
            theme={theme}
            orderBadge={orderBadge}
          />
        )
      }
    >
      <Tab.Screen name="Overview" component={DashboardScreen} />
      <Tab.Screen name="Catalog" component={CatalogScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Chats" component={SellerChatsScreen} />
      <Tab.Screen name="Feedback" component={FeedbackScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

/** Default mobile bottom tab bar for seller app */
const DefaultSellerTabBar = ({
  state,
  descriptors,
  navigation,
  theme,
  orderBadge,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { bottom: insets.bottom + 12 }]}>
      {state.routes.map((route, index) => {
        // Feedback is sidebar-only; hide it from the mobile bottom bar
        if (route.name === "Feedback") return null;
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused
          ? theme.primary || colors.primary
          : colors.muted;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented)
            navigation.navigate(route.name);
        };
        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabBarItem}
          >
            <View>
              <Ionicons
                name={icons[route.name] || "ellipse"}
                size={24}
                color={color}
              />
              {route.name === "Orders" && orderBadge && (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>{orderBadge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color }]}>{route.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Wrapper that waits for seller context to finish loading
const SellerApp = ({ onLogout }) => {
  const { loading: sellerLoading, needsSubaccount } = useSeller();

  if (sellerLoading) {
    return (
      <View style={styles.scene}>
        <LoadingAnimation />
      </View>
    );
  }
  return (
    <View style={styles.appBackground}>
      <SellerStack onLogout={onLogout} />
      {needsSubaccount && <PaymentSetupPrompt />}
    </View>
  );
};

// Component that auto-navigates to PaystackSetup when rendered inside NavigationContainer
const PaymentSetupPrompt = () => {
  const navigation = useNavigation();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        navigation.navigate("PaystackSetup");
      } catch (e) {
        // Navigation may not be ready
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [navigation]);

  return null;
};
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={SellerLoginScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    {/* password reset now shown directly when a recovery token arrives */}
  </Stack.Navigator>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // AsyncStorage keys
  const AUTH_USER_KEY = "express_seller_user";
  const AUTH_ROLE_KEY = "express_seller_role";

  // Store authentication state
  const storeAuthState = async (user, role) => {
    try {
      const normalizedRole = normalizeRole(role);
      if (user) {
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        await AsyncStorage.setItem(
          AUTH_ROLE_KEY,
          normalizedRole ? normalizedRole : "",
        );
      } else {
        await AsyncStorage.removeItem(AUTH_USER_KEY);
        await AsyncStorage.removeItem(AUTH_ROLE_KEY);
      }
    } catch (error) {
      console.error("Error storing auth state:", error);
    }
  };

  // Retrieve authentication state
  const getStoredAuthState = async () => {
    try {
      const userString = await AsyncStorage.getItem(AUTH_USER_KEY);
      const roleString = await AsyncStorage.getItem(AUTH_ROLE_KEY);
      if (userString) {
        return {
          user: JSON.parse(userString),
          role: roleString || null,
        };
      }
    } catch (error) {
      console.error("Error retrieving auth state:", error);
    }
    return null;
  };

  useEffect(() => {
    // Supabase handles session persistence automatically with our configuration
    // Just listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // no password recovery handling inside app

        const newUser = session?.user ?? null;
        const newRole = normalizeRole(newUser?.user_metadata?.role || null);

        setUser(newUser);
        setUserRole(newRole);
        setLoading(false);

        // Store auth state for backup (optional) without blocking auth callback.
        storeAuthState(newUser, newRole);
      },
    );

    // Initial check
    const checkInitialAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
        setUserRole(normalizeRole(user?.user_metadata?.role || null));
      } catch (error) {
        console.error("Error checking initial auth:", error);
        setUser(null);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    };

    checkInitialAuth();

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Clear stored auth state
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      await AsyncStorage.removeItem(AUTH_ROLE_KEY);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!supabase) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.scene}>
          <MissingConfig />
        </View>
      </SafeAreaProvider>
    );
  }

  if (loading) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <LoadingAnimation />
      </SafeAreaProvider>
    );
  }

  const isSeller = user && userRole === "seller";
  const isOtherRole = user && userRole && userRole !== "seller";

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SellerProvider>
          <NotificationProvider userId={user?.id}>
            <NavigationContainer theme={navTheme} linking={linking}>
              <StatusBar style="dark" />
              {isSeller ? (
                <SellerApp onLogout={handleLogout} />
              ) : isOtherRole ? (
                <View style={styles.scene}>
                  <View style={styles.center}>
                    <Ionicons
                      name="storefront-outline"
                      size={80}
                      color={colors.secondary}
                      style={{ marginBottom: 16 }}
                    />
                    <Text style={styles.title}>Access Denied</Text>
                    <Text style={styles.subtitle}>
                      You do not have seller privileges.
                    </Text>
                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleLogout}
                    >
                      <Text style={styles.buttonText}>Logout</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <AuthStack />
              )}
            </NavigationContainer>
          </NotificationProvider>
        </SellerProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appBackground: {
    flex: 1,
    backgroundColor: colors.light,
    paddingTop: Platform.OS === "ios" ? 50 : 0,
  },
  scene: {
    flex: 1,
    backgroundColor: colors.light,
    paddingTop: Platform.OS === "ios" ? 50 : 0,
  },
  sceneWithFloatingTab: {
    flex: 1,
    backgroundColor: colors.light,
    paddingBottom: 130,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    marginHorizontal: 16,
    borderRadius: 28,
    height: 70,
    shadowColor: colors.dark,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 12,
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  tabLabel: {
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  tabBarItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.dark,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    color: colors.muted,
    textAlign: "center",
  },
});
