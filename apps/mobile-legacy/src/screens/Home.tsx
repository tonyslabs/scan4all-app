import { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import * as DocPicker from "expo-document-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function Home({ navigation }: Props) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");

  const pickFile = async () => {
    try {
      setBusy(true);
      const res = await DocPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets[0];
      navigation.navigate("Review", {
        kind: "file",
        uri: file.uri,
        name: file.name,
        mime: file.mimeType ?? "application/octet-stream",
      });
    } finally {
      setBusy(false);
    }
  };

  const analyzeUrl = () => {
    if (!url.trim()) {
      Alert.alert("Campo vacío", "Ingresa una URL válida.");
      return;
    }
    navigation.navigate("Review", { kind: "url", uri: url, name: url, mime: "text/plain" });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Text style={styles.title}>Scan4All</Text>
      <Text style={styles.subtitle}>Analiza archivos o URLs con VirusTotal</Text>

      <TouchableOpacity
        style={[styles.button, busy && styles.disabled]}
        onPress={pickFile}
        disabled={busy}
      >
        <Ionicons name="document-text-outline" size={22} color="#fff" />
        <Text style={styles.buttonText}>Seleccionar archivo</Text>
      </TouchableOpacity>

      <View style={styles.urlBox}>
        <TextInput
          placeholder="https://ejemplo.com"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor="#999"
          style={styles.input}
        />
        <TouchableOpacity
          style={[styles.button, styles.secondary, busy && styles.disabled]}
          onPress={analyzeUrl}
          disabled={busy}
        >
          <Ionicons name="link-outline" size={20} color="#000" />
          <Text style={[styles.buttonText, { color: "#000" }]}>Analizar URL</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Versión 1.0 • © 2025 dariuskxll</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", alignItems: "center", paddingTop: 80 },
  title: { fontSize: 36, fontWeight: "800", color: "#000" },
  subtitle: { color: "#555", marginTop: 6, marginBottom: 50, fontSize: 15 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
    height: 54,
    borderRadius: 14,
    marginVertical: 8,
    gap: 8,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondary: { backgroundColor: "#f2f2f2" },
  disabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  urlBox: { marginTop: 20, width: "85%", alignItems: "center", gap: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    fontSize: 15,
    color: "#000",
    backgroundColor: "#fafafa",
  },
  footer: { color: "#aaa", fontSize: 13, position: "absolute", bottom: 30 },
});
