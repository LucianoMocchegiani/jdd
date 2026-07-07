//! Adaptadores inbound (HTTP, Redis) y outbound (Postgres, Redis, wire).

pub mod inbound;
pub mod outbound;

pub mod rediskeys {
    /// `chunk_wire_key` — operación pública del módulo.
    pub fn chunk_wire_key(bloque_id: &str, cx: i32, cy: i32) -> String {
        format!("chunk:wire:{bloque_id}:{cx},{cy}")
    }

    /// `chunk_solid_key` — operación pública del módulo.
    pub fn chunk_solid_key(bloque_id: &str, cx: i32, cy: i32) -> String {
        format!("chunk:solid:{bloque_id}:{cx},{cy}")
    }

    /// `chunk_ver_key` — operación pública del módulo.
    pub fn chunk_ver_key(bloque_id: &str, cx: i32, cy: i32) -> String {
        format!("chunk:ver:{bloque_id}:{cx},{cy}")
    }

    /// `chunk_pending_key` — operación pública del módulo.
    pub fn chunk_pending_key(bloque_id: &str, cx: i32, cy: i32) -> String {
        format!("chunk:pending:{bloque_id}:{cx},{cy}")
    }

    /// `block_ver_key` — operación pública del módulo.
    pub fn block_ver_key(bloque_id: &str) -> String {
        format!("block:ver:{bloque_id}")
    }

    pub const STREAM_TERRAIN_REQUESTS: &str = "terrain:requests";
    pub const STREAM_TERRAIN_READY: &str = "terrain:ready";
    pub const STREAM_TERRAIN_INVALIDATE: &str = "terrain:invalidate";
    pub const STREAM_BLOCK_SEEDED: &str = "world:block_seeded";

    pub const GROUP_TERRAIN_WORKERS: &str = "terrain-workers";
    pub const GROUP_TERRAIN_INVALIDATE: &str = "terrain-invalidate";
    pub const GROUP_TERRAIN_SEED: &str = "terrain-seed";
}
