//! Chunk coordinates — mirror go/pkg/jd/chunkcoords and Python chunk_coords.py.

pub fn coord_from_cell(cell: i32, chunk_size: i32) -> i32 {
    if cell >= 0 {
        cell / chunk_size
    } else {
        (cell - chunk_size + 1) / chunk_size
    }
}

/// `key` — operación pública del módulo.
pub fn key(cx: i32, cy: i32) -> String {
    format!("{cx},{cy}")
}

/// `key_from_cell` — operación pública del módulo.
pub fn key_from_cell(x: i32, y: i32, chunk_size: i32) -> String {
    key(
        coord_from_cell(x, chunk_size),
        coord_from_cell(y, chunk_size),
    )
}

/// `cell_bounds` — operación pública del módulo.
pub fn cell_bounds(cx: i32, cy: i32, chunk_size: i32) -> (i32, i32, i32, i32) {
    let x_min = cx * chunk_size;
    let y_min = cy * chunk_size;
    (
        x_min,
        x_min + chunk_size - 1,
        y_min,
        y_min + chunk_size - 1,
    )
}
