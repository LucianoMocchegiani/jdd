//! terrain-service — M1 Clean Architecture (domain → application → adapters).

pub mod adapters;
pub mod application;
pub mod chunkcoords;
pub mod config;
pub mod domain;
pub mod session;

pub use config::Config;
