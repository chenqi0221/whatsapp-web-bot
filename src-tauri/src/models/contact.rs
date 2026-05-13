use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
    pub id: String,
    pub name: String,
    #[serde(rename = "isGroup")]
    pub is_group: bool,
    #[serde(rename = "lastMessage")]
    pub last_message: Option<String>,
    pub participants: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub number: String,
    pub lid: Option<String>,
}
