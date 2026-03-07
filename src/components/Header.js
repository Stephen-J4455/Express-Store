import { StyleSheet, Text, View, Platform } from "react-native";
import { colors } from "../theme/colors";
import { useResponsive } from "../hooks/useResponsive";

export const Header = ({ title }) => {
  const { horizontalPadding } = useResponsive();
  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.dark,
    letterSpacing: -0.5,
  },
});
