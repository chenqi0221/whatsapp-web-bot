use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastProgress {
    pub running: bool,
    pub current: i32,
    pub total: i32,
    pub results: Vec<BroadcastResult>,
    pub message: Option<String>,
    pub interval: i32,
    #[serde(rename = "dailySent")]
    pub daily_sent: i32,
    #[serde(rename = "dailyLimit")]
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
    #[serde(rename = "randomInterval")]
    pub random_interval: bool,
    #[serde(rename = "randomizeMsg")]
    pub randomize_msg: bool,
    #[serde(rename = "lengthRandomize")]
    pub length_randomize: bool,
    #[serde(rename = "simulateTyping")]
    pub simulate_typing: bool,
    #[serde(rename = "simulateMouse")]
    pub simulate_mouse: bool,
    #[serde(rename = "respectHours")]
    pub respect_hours: bool,
    #[serde(rename = "randomPause")]
    pub random_pause: bool,
    #[serde(rename = "excludeGroups")]
    pub exclude_groups: bool,
    pub personalize: bool,
    #[serde(rename = "targetType")]
    pub target_type: String,
    #[serde(rename = "manualNumbers")]
    pub manual_numbers: Option<String>,
    #[serde(rename = "accountLevel")]
    pub account_level: String,
}
