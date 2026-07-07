//! Tests de merge por celda y wire particles.

#[cfg(test)]
mod chunk_authority_tests {
    use std::collections::HashMap;

    use terrain_service::domain::chunk_authority;
    use terrain_service::domain::particle::{ParticleRow, PhysicsType};

    fn row(x: i32, y: i32, z: i32, phys: PhysicsType) -> ParticleRow {
        ParticleRow {
            id: format!("{x}-{y}-{z}"),
            celda_x: x,
            celda_y: y,
            celda_z: z,
            tipo_nombre: "tierra".into(),
            tipo_fisico: phys,
            color: None,
            viscosidad: None,
            opacidad: None,
        }
    }

    #[test]
    fn merge_last_row_wins_per_cell() {
        let rows = vec![row(1, 1, 0, PhysicsType::Solido), row(1, 1, 0, PhysicsType::Gas)];
        let merged = chunk_authority::merge_rows_by_cell(&rows);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[&(1, 1, 0)].tipo_fisico, PhysicsType::Gas);
    }

    #[test]
    fn solid_cells_only_solido() {
        let mut by_cell = HashMap::new();
        by_cell.insert((0, 0, 0), row(0, 0, 0, PhysicsType::Solido));
        by_cell.insert((1, 0, 0), row(1, 0, 0, PhysicsType::Liquido));
        let solids = chunk_authority::solid_cells(&by_cell);
        assert_eq!(solids, vec!["0,0,0"]);
    }

    #[test]
    fn wire_filters_to_chunk_bounds() {
        let mut by_cell = HashMap::new();
        by_cell.insert((40, 0, 0), row(40, 0, 0, PhysicsType::Solido));
        by_cell.insert((79, 39, 1), row(79, 39, 1, PhysicsType::Solido));
        by_cell.insert((80, 0, 0), row(80, 0, 0, PhysicsType::Solido));
        let wire = chunk_authority::wire_particles_for_chunk(&by_cell, 1, 0, 40);
        assert_eq!(wire.len(), 2);
    }
}
