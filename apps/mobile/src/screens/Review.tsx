import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

export default function Review({ route }: Props) {
  const { kind, uri, name, mime } = route.params;
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const upload = async () => {
    setLoading(true);
    setResult(null);
    setStatus("Enviando a análisis...");

    const endpoint =
      kind === "url"
        ? "http://10.0.2.2:8000/scan/url"
        : "http://10.0.2.2:8000/scan/upload";

    let body: any;
    let headers: any = {};

    if (kind === "url") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ url: uri });
    } else {
      body = new FormData();
      body.append("file", {
        // @ts-ignore
        uri,
        name: name ?? "file.bin",
        type: mime ?? "application/octet-stream",
      });
    }

    try {
      const res = await fetch(endpoint, { method: "POST", headers, body });
      const json = await res.json();
      const id = json?.vt?.data?.id;
      if (!id) throw new Error("No se recibió analysis_id");
      setStatus("Analizando...");
      pollStatus(id);
    } catch (e: any) {
      setStatus("Error: " + e.message);
      setLoading(false);
    }
  };

  const pollStatus = async (id: string) => {
    const url = `http://10.0.2.2:8000/scan/status/${id}`;
    let done = false;
    while (!done) {
      try {
        const res = await fetch(url);
        const json = await res.json();
        const state = json?.data?.attributes?.status;
        if (state === "completed") {
          done = true;
          setResult(json);
          setStatus("Análisis completado");
        } else {
          setStatus(`Esperando resultado (${state})...`);
          await new Promise((r) => setTimeout(r, 4000));
        }
      } catch (e: any) {
        setStatus("Error al consultar estado: " + e.message);
        done = true;
      }
    }
    setLoading(false);
  };

  const renderSummary = () => {
    if (!result) return null;
    const stats = result?.data?.attributes?.stats ?? {};
    const total =
      stats.harmless + stats.malicious + stats.suspicious + stats.undetected;
    const percentHarmless = Math.round((stats.harmless / total) * 100 || 0);
    const percentMalicious = Math.round((stats.malicious / total) * 100 || 0);

    const isUnsupported =
      stats.harmless === 0 &&
      stats.malicious === 0 &&
      stats.suspicious === 0 &&
      stats.undetected > 0;

    return (
      <View style={styles.summary}>
        <Ionicons
          name={
            percentMalicious > 0
              ? "alert-circle"
              : isUnsupported
              ? "help-circle-outline"
              : "checkmark-circle"
          }
          size={60}
          color={
            percentMalicious > 0
              ? "#d9534f"
              : isUnsupported
              ? "#ffb700"
              : "#28a745"
          }
        />
        <Text style={styles.summaryTitle}>
          {percentMalicious > 0
            ? "Amenaza detectada"
            : isUnsupported
            ? "Tipo de archivo no soportado"
            : "Archivo/URL seguro"}
        </Text>

        {!isUnsupported && (
          <Text style={styles.summaryText}>
            {percentHarmless}% seguro, {percentMalicious}% malicioso
          </Text>
        )}

        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => setShowDetails(!showDetails)}
        >
          <Ionicons
            name={showDetails ? "eye-off-outline" : "eye-outline"}
            size={18}
            color="#000"
          />
          <Text style={styles.detailText}>
            {showDetails ? "Ocultar detalles" : "Ver detalles"}
          </Text>
        </TouchableOpacity>

        {showDetails && (
          <ScrollView style={styles.detailsBox} nestedScrollEnabled>
            {Object.entries(result?.data?.attributes?.results ?? {}).map(
              ([engine, info]: any) => (
                <View key={engine} style={styles.engineRow}>
                  <Text style={styles.engineName}>{engine}</Text>
                  <Text
                    style={[
                      styles.engineResult,
                      info.category === "harmless"
                        ? { color: "#28a745" }
                        : info.category === "malicious"
                        ? { color: "#d9534f" }
                        : { color: "#999" },
                    ]}
                  >
                    {info.result ?? "—"}
                  </Text>
                </View>
              )
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Análisis</Text>

      <View style={styles.card}>
        <Ionicons
          name={kind === "url" ? "link-outline" : "document-outline"}
          size={30}
          color="#000"
          style={{ marginBottom: 10 }}
        />
        <Text style={styles.name}>{name}</Text>

        {kind === "url" && (
          <Text style={[styles.meta, { color: "#007aff" }]} numberOfLines={2}>
            {uri}
          </Text>
        )}
        {kind === "image" && (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        )}
        <Text style={styles.meta}>Tipo: {kind}</Text>
        <Text style={styles.meta}>MIME: {mime}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={upload}
        disabled={loading}
      >
        <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>
          {loading ? "Analizando..." : "Enviar a análisis"}
        </Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} />}

      <Text style={styles.status}>{status}</Text>

      {renderSummary()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: "center", backgroundColor: "#fff", flexGrow: 1 },
  title: { fontSize: 32, fontWeight: "800", color: "#000", marginVertical: 20 },
  card: {
    width: "100%",
    backgroundColor: "#f8f8f8",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  name: { fontSize: 18, fontWeight: "600", color: "#000", textAlign: "center", marginBottom: 6 },
  meta: { fontSize: 14, color: "#666", marginTop: 2 },
  image: { width: "100%", height: 200, borderRadius: 12, marginVertical: 12 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "85%",
    height: 54,
    borderRadius: 14,
    backgroundColor: "#000",
    marginTop: 24,
    gap: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  status: { fontSize: 14, color: "#444", marginTop: 16 },
  summary: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginTop: 20,
  },
  summaryTitle: { fontSize: 20, fontWeight: "700", marginTop: 10, color: "#000" },
  summaryText: { fontSize: 15, color: "#555", marginTop: 4 },
  detailButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  detailText: { fontSize: 14, color: "#000" },
  detailsBox: {
    width: "100%",
    maxHeight: 300,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
  },
  engineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  engineName: { fontSize: 13, color: "#000", flex: 1 },
  engineResult: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
});
