import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const toneConfigs = {
  primary: {
    gradient: [colors.primary, colors.primaryDark],
    icon: "stats-chart",
    lightBg: colors.primaryLight,
  },
  accent: {
    gradient: [colors.accent, colors.primary],
    icon: "analytics",
    lightBg: colors.primaryLight,
  },
  success: {
    gradient: [colors.success, "#059669"],
    icon: "checkmark-circle",
    lightBg: colors.successLight,
  },
  info: {
    gradient: [colors.info, "#0891b2"],
    icon: "information-circle",
    lightBg: colors.infoLight,
  },
  warning: {
    gradient: [colors.warning, "#d97706"],
    icon: "warning",
    lightBg: colors.warningLight,
  },
  danger: {
    gradient: [colors.danger, "#dc2626"],
    icon: "alert-circle",
    lightBg: colors.dangerLight,
  },
};

export const StatCard = ({ label, value, hint, trend = "+0%", tone = "primary" }) => {
  const config = toneConfigs[tone] || toneConfigs.primary;
  return (
    <View style={styles.container}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: config.lightBg }]}>
          <Ionicons name={config.icon} size={18} color={config.gradient[0]} />
        </View>
        <View style={styles.trendBadge}>
          <Text style={[styles.trendText, { color: config.gradient[0] }]}>{trend}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { backgroundColor: config.gradient[0], width: "70%" }]} />
        </View>

        {hint ? (
          <View style={styles.hintContainer}>
            <Ionicons name="flash" size={12} color={config.gradient[0]} />
            <Text style={styles.hint} numberOfLines={1}>
              {hint}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    minWidth: 150,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  trendText: {
    fontSize: 10,
    fontWeight: "800",
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  content: {
    gap: 2,
  },
  value: {
    color: colors.dark,
    fontSize: 22,
    fontWeight: "900",
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  hintContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
});
