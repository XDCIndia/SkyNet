// Package main implements the XDCNet Node Agent v2.
// A cross-platform heartbeat agent that collects system metrics
// and reports them to the XDCNet dashboard.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"
)

// Version is set at build time via -ldflags.
var Version = "dev"

// Heartbeat represents the payload sent to the dashboard API.
type Heartbeat struct {
	NodeID    string  `json:"node_id"`
	Timestamp string  `json:"timestamp"`
	OS        string  `json:"os"`
	Arch      string  `json:"arch"`
	CPUPct    float64 `json:"cpu_pct"`
	MemPct    float64 `json:"mem_pct"`
	DiskPct   float64 `json:"disk_pct"`
	Version   string  `json:"version"`
}

func main() {
	nodeID := flag.String("node-id", "", "Unique node identifier (required)")
	endpoint := flag.String("endpoint", "http://localhost:3000/api/heartbeat", "Dashboard API endpoint")
	interval := flag.Duration("interval", 30*time.Second, "Heartbeat interval")
	flag.Parse()

	if *nodeID == "" {
		if v := os.Getenv("XDCNET_NODE_ID"); v != "" {
			*nodeID = v
		} else {
			log.Fatal("--node-id is required (or set XDCNET_NODE_ID)")
		}
	}

	log.Printf("XDCNet Agent %s starting (node=%s, interval=%s)", Version, *nodeID, *interval)

	ticker := time.NewTicker(*interval)
	defer ticker.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Send initial heartbeat immediately
	sendHeartbeat(*nodeID, *endpoint)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(*nodeID, *endpoint)
		case sig := <-sigCh:
			log.Printf("Received %s, shutting down", sig)
			return
		}
	}
}

func sendHeartbeat(nodeID, endpoint string) {
	hb := Heartbeat{
		NodeID:    nodeID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		Version:   Version,
		// TODO: Replace with real metrics from gopsutil
		CPUPct:  0,
		MemPct:  0,
		DiskPct: 0,
	}

	body, err := json.Marshal(hb)
	if err != nil {
		log.Printf("ERROR marshal: %v", err)
		return
	}

	resp, err := http.Post(endpoint, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("ERROR post: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("WARN heartbeat returned %d", resp.StatusCode)
	} else {
		fmt.Printf("♥ heartbeat sent (%s)\n", hb.Timestamp)
	}
}
