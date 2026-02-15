import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type NodeMetrics = {
  nodeId: string;
  cpuPct: number;
  memPct: number;
  diskPct: number;
  blockHeight: number;
  peerCount: number;
  isHealthy: boolean;
  lastSeen: string;
};

type Props = NativeStackScreenProps<RootStackParamList, "NodeDetail">;

export default function NodeDetailScreen({ route }: Props) {
  const { nodeId } = route.params;
  const [metrics, setMetrics] = useState<NodeMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/nodes/${nodeId}`)
      .then((res) => res.json())
      .then(setMetrics)
      .catch((err) => console.error("Failed to fetch node:", err))
      .finally(() => setLoading(false));
  }, [nodeId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={styles.center}>
        <Text>Node not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View
          style={[
            styles.dot,
            { backgroundColor: metrics.isHealthy ? "#22c55e" : "#ef4444" },
          ]}
        />
        <Text style={styles.title}>{nodeId}</Text>
      </View>

      <MetricCard label="CPU" value={`${metrics.cpuPct.toFixed(1)}%`} />
      <MetricCard label="Memory" value={`${metrics.memPct.toFixed(1)}%`} />
      <MetricCard label="Disk" value={`${metrics.diskPct.toFixed(1)}%`} />
      <MetricCard label="Block Height" value={metrics.blockHeight.toLocaleString()} />
      <MetricCard label="Peers" value={String(metrics.peerCount)} />
      <MetricCard label="Last Seen" value={metrics.lastSeen} />
    </ScrollView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  title: { fontSize: 22, fontWeight: "bold" },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: { fontSize: 15, color: "#555" },
  value: { fontSize: 15, fontWeight: "600" },
});
