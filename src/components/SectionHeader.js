import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export const SectionHeader = ({ title, subtitle, action }) => {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        typeof action === 'string' ? (
          <Text style={styles.actionText}>{action}</Text>
        ) : (
          action
        )
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.dark,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6,
    fontSize: 14,
  },
  actionText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
