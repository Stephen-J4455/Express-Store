import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabase";
import { useToast } from "../context/ToastContext";
import { colors } from "../theme/colors";
import { ResponsiveContainer } from "../components/ResponsiveContainer";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const toast = useToast();

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Error", "Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Error", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      // send users to the universal web page, passing our scheme so the page
      // can later deep-link back into this app
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // page must be served via HTTPS; using GitHub Pages link
        redirectTo:
          "https://stephen-j4455.github.io/express-password-reset/password-reset.html?scheme=expressseller",
      });

      if (error) {
        toast.error("Error", error.message);
      } else {
        setEmailSent(true);
      }
    } catch (error) {
      toast.error("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <ResponsiveContainer maxWidth={480}>
        <SafeAreaView style={styles.container}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="mail" size={60} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Check Your Email</Text>
            <Text style={styles.successMessage}>
              We've sent a password reset link to:
            </Text>
            <Text style={styles.successEmail}>{email}</Text>
            <Text style={styles.successHint}>
              Click the link in the email to reset your password. If you don't
              see the email, check your spam folder.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>Back to Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => setEmailSent(false)}
            >
              <Text style={styles.resendText}>
                Didn't receive email? Try again
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer maxWidth={480}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.dark} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-open" size={50} color={colors.primary} />
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              No worries! Enter your email address and we'll send you a link to
              reset your password.
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={colors.muted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="send"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.buttonText}>Send Reset Link</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password?</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.dark,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border || "#E4E8F0",
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: colors.dark,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 16,
    color: colors.muted,
  },
  footerLink: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  // Success state styles
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.dark,
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 16,
    color: colors.muted,
    textAlign: "center",
  },
  successEmail: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 8,
    marginBottom: 24,
  },
  successHint: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  resendButton: {
    marginTop: 20,
    padding: 12,
  },
  resendText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "500",
  },
});
