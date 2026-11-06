  /** Last applied client input sequence. */
  input_seq?: number;
  /** Current authoritative health; initially in-memory only. */
  health?: number;
  max_health?: number;
  /** Marca de llegada WS (solo cliente, debug). */
  receivedAtMs?: number;
}
