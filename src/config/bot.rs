use log::{info, warn};

#[derive(Clone, Debug, Default)]
pub struct Config {
	pub redis_url: Option<String>,
}

impl Config {
	pub fn new(redis_url: Option<String>) -> Self {
		Self { redis_url }
	}

	pub fn from_env() -> Self {
		let redis_url = std::env::var("BOT_REDIS_URL").ok();

		if let Some(url) = &redis_url {
			info!("Redis URL is {url}");
		} else {
			warn!("BOT_REDIS_URL is empty; features requiring storage will be disabled.");
		}

		Self::new(redis_url)
	}
}
