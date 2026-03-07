import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

// The seller app no longer supports in-app password resets.  This screen
// simply nudges the user to the web version and offers a quick button.

export default function PasswordResetScreen() {
  const openWeb = () => {
    const url = "https://stephen-j4455.github.io/express-password-reset/password-reset.html";
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.messageBox}>
        <Text style={styles.title}>Please use the web</Text>
        <Text style={styles.text}>
          Password reset must be completed on the website. Click below to go
          there.
        </Text>
        <TouchableOpacity style={styles.button} onPress={openWeb}>
          <Text style={styles.buttonText}>Go to Web Reset</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', padding:20, backgroundColor: colors.light },
  messageBox: { alignItems:'center' },
  title: { fontSize:22, fontWeight:'700', marginBottom:12, color: colors.primary },
  text: { fontSize:16, color: colors.dark, textAlign:'center', marginBottom:20 },
  button: { backgroundColor: colors.primary, paddingHorizontal:24, paddingVertical:12, borderRadius:8 },
  buttonText: { color:'#fff', fontWeight:'600' }
});
