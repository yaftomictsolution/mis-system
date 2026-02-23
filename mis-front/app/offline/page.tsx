export default function OfflinePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>You are offline</h1>
      <p style={{ marginTop: 8, color: "#666" }}>
        The app UI is available, but some live data may be outdated until internet returns.
      </p>
    </div>
  );
}
