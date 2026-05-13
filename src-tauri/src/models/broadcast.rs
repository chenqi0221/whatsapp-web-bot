use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastProgress {
    pub running: bool,
    pub current: i32,
    pub total: i32,
    pub results: Vec<BroadcastResult>,
    pub message: Option<String>,
    pub interval: i32,
    pub daily_sent: i32,
    pub daily_limit: i32,
    pub remaining: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastResult {
    pub name: String,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastOptions {
    pub message: Vec<String>,
    pub interval: i32,
    pub random_interval: bool,
    pub randomize_msg: bool,
    pub length_randomize: bool,
    pub simulate_typing: bool,
    pub simulate_mouse: bool,
    pub respect_hours: bool,
    pub random_pause: bool,
    pub exclude_groups: bool,
    pub personalize: bool,
    pub target_type: String,
    pub manual_numbers: Option<String>,
    pub account_level: String,
}
