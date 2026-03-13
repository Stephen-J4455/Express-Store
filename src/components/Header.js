import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { useResponsive } from "../hooks/useResponsive";

export const Header = ({ title }) => {
  const { horizontalPadding } = useResponsive();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: horizontalPadding, paddingTop: insets.top + 8 },
      ]}
    >
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
