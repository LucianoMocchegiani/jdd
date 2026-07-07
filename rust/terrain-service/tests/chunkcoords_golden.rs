//! Tests golden de chunkcoords vs Go.

use terrain_service::chunkcoords;

const CHUNK_SIZE: i32 = 40;

#[test]
fn coord_from_cell_golden() {
    let cases: &[(i32, i32)] = &[
        (0, 0),
        (39, 0),
        (40, 1),
        (45, 1),
        (-1, -1),
        (-40, -1),
        (-41, -2),
    ];
    for (cell, want) in cases {
        assert_eq!(
            chunkcoords::coord_from_cell(*cell, CHUNK_SIZE),
            *want,
            "cell={cell}"
        );
    }
}

#[test]
fn key_from_cell_golden() {
    assert_eq!(
        chunkcoords::key_from_cell(45, 45, CHUNK_SIZE),
        "1,1"
    );
}

#[test]
fn cell_bounds_golden() {
    let (x_min, x_max, y_min, y_max) = chunkcoords::cell_bounds(1, 0, CHUNK_SIZE);
    assert_eq!((x_min, x_max, y_min, y_max), (40, 79, 0, 39));
}
