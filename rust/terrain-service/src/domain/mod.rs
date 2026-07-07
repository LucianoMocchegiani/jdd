//! Lógica de dominio pura: partículas, merge por celda y wire format.

pub mod particle;
pub mod port;

pub mod chunk_authority {
    use std::collections::HashMap;

    use super::particle::{ParticleRow, PhysicsType, WireParticle};

    /// `CellKey`.
    pub type CellKey = (i32, i32, i32);

    /// Merge DB rows by cell for one chunk tile (REF: terrain_store.py merge).
    pub fn merge_rows_by_cell(rows: &[ParticleRow]) -> HashMap<CellKey, ParticleRow> {
        let mut by_cell: HashMap<CellKey, ParticleRow> = HashMap::new();
        for row in rows {
            let key = (row.celda_x, row.celda_y, row.celda_z);
            by_cell.insert(key, row.clone());
        }
        by_cell
    }

    /// `wire_particles_for_chunk` — operación pública del módulo.
    pub fn wire_particles_for_chunk(
        by_cell: &HashMap<CellKey, ParticleRow>,
        chunk_cx: i32,
        chunk_cy: i32,
        chunk_size: i32,
    ) -> Vec<WireParticle> {
        let (x_min, x_max, y_min, y_max) =
            crate::chunkcoords::cell_bounds(chunk_cx, chunk_cy, chunk_size);

        let mut out = Vec::with_capacity(by_cell.len());
        for ((x, y, z), row) in by_cell {
            if *x < x_min || *x > x_max || *y < y_min || *y > y_max {
                continue;
            }
            out.push(WireParticle {
                id: row.id.clone(),
                x: *x,
                y: *y,
                z: *z,
                tipo_nombre: row.tipo_nombre.clone(),
                tipo_fisico: row.tipo_fisico.clone(),
            });
        }
        out.sort_by(|a, b| (a.x, a.y, a.z).cmp(&(b.x, b.y, b.z)));
        out
    }

    /// `solid_cells` — operación pública del módulo.
    pub fn solid_cells(by_cell: &HashMap<CellKey, ParticleRow>) -> Vec<String> {
        let mut solids: Vec<String> = by_cell
            .iter()
            .filter(|(_, row)| row.tipo_fisico == PhysicsType::Solido)
            .map(|((x, y, z), _)| format!("{x},{y},{z}"))
            .collect();
        solids.sort();
        solids
    }
}
