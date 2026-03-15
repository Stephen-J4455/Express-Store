import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import { colors } from "../theme/colors";

const { width, height } = Dimensions.get("window");

export const LoadingAnimation = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial fade and scale in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const logoPulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.08,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );

    // Staggered pulse animations
    const pulseAnimation = Animated.loop(
      Animated.stagger(200, [
        Animated.sequence([
          Animated.timing(pulse1, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulse1, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse2, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulse2, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse3, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulse3, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    logoPulseAnimation.start();
    pulseAnimation.start();

    return () => {
      logoPulseAnimation.stop();
      pulseAnimation.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Background Pattern */}
      <View style={styles.backgroundPattern}>
        {[...Array(20)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.patternDot,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.1],
                }),
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      {/* Main Loading Content */}
      <Animated.View
        style={[
          styles.loadingContent,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Pulsing Express logo */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: logoPulse }],
            },
          ]}
        >
          <Image
            source={require("../../assets/express.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Title */}
        <Text style={styles.appTitle}>Express Seller</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Powering your business</Text>

        {/* Pulse Dots */}
        <View style={styles.pulseContainer}>
          <Animated.View
            style={[
              styles.pulseDot,
              {
                opacity: pulse1,
                transform: [
                  {
                    scale: pulse1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseDot,
              {
                opacity: pulse2,
                transform: [
                  {
                    scale: pulse2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseDot,
              {
                opacity: pulse3,
                transform: [
                  {
                    scale: pulse3.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        {/* Loading Text */}
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light,
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundPattern: {
    position: "absolute",
    width: width * 2,
    height: height * 2,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.3,
  },
  patternDot: {
    width: 4,
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
    margin: 20,
  },
  loadingContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 104,
    height: 104,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.dark,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: 40,
    textAlign: "center",
    fontWeight: "500",
  },
  pulseContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginHorizontal: 6,
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    fontWeight: "500",
  },
});
